use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent};

#[derive(Serialize)]
struct ConfigView {
    gemini_api_key: String,
    whisper_model: String,
    music_backend: String,
    yandex_music_url: String,
    command_timeout_sec: i64,
    user_name: String,
    allow_shutdown: bool,
    auto_confirm_dangerous_commands: bool,
    working_folder_path: String,
    accent_color: String,
    first_launch: bool,
}

#[derive(Serialize, Deserialize, Default)]
struct Note {
    id: i64,
    text: String,
    created_at: String,
    done: i64,
}

fn notes_db_path() -> PathBuf {
    project_root()
        .join("python-core")
        .join("models")
        .join("notes.db")
}

/// Open the notes DB, ensuring the table exists (for first-run before Python creates it).
fn open_notes_db() -> Result<Connection, String> {
    let path = notes_db_path();
    // Create parent dir if needed
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            text       TEXT NOT NULL,
            created_at TEXT,
            done       INTEGER NOT NULL DEFAULT 0
        );",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn project_root() -> PathBuf {
    let mut p = std::env::current_exe().unwrap_or_default();
    for _ in 0..8 {
        p.pop();
        if p.join("config.json").exists() {
            return p;
        }
    }
    PathBuf::from(".")
}

fn config_path() -> PathBuf {
    project_root().join("config.json")
}

fn defaults() -> Value {
    json!({
      "gemini_api_key": "",
      "whisper_model": "tiny",
      "music_backend": "yandex",
      "yandex_music_url": "https://music.yandex.ru",
      "command_timeout_sec": 15,
      "user_name": "Лейтенант",
      "allow_shutdown": false,
      "auto_confirm_dangerous_commands": false,
      "working_folder_path": "",
      "accent_color": "#00B4D8",
      "first_launch": true
    })
}

fn load_config_value() -> Result<Value, String> {
    let path = config_path();
    let mut v = defaults();
    if path.exists() {
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let read: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if let Some(obj) = read.as_object() {
            for (k, val) in obj {
                v[k] = val.clone();
            }
        }
    }
    Ok(v)
}

#[tauri::command]
fn load_config() -> Result<ConfigView, String> {
    let v = load_config_value()?;
    Ok(ConfigView {
        gemini_api_key: v["gemini_api_key"].as_str().unwrap_or("").to_string(),
        whisper_model: v["whisper_model"].as_str().unwrap_or("tiny").to_string(),
        music_backend: v["music_backend"].as_str().unwrap_or("yandex").to_string(),
        yandex_music_url: v["yandex_music_url"].as_str().unwrap_or("https://music.yandex.ru").to_string(),
        command_timeout_sec: v["command_timeout_sec"].as_i64().unwrap_or(15),
        user_name: v["user_name"].as_str().unwrap_or("Лейтенант").to_string(),
        allow_shutdown: v["allow_shutdown"].as_bool().unwrap_or(false),
        auto_confirm_dangerous_commands: v["auto_confirm_dangerous_commands"].as_bool().unwrap_or(false),
        working_folder_path: v["working_folder_path"].as_str().unwrap_or("").to_string(),
        accent_color: v["accent_color"].as_str().unwrap_or("#00B4D8").to_string(),
        first_launch: v["first_launch"].as_bool().unwrap_or(true),
    })
}

#[tauri::command]
fn save_config(config: Value) -> Result<(), String> {
    let mut current = load_config_value()?;
    if let Some(obj) = config.as_object() {
        for (k, val) in obj {
            current[k] = val.clone();
        }
    }
    fs::write(
        config_path(),
        serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn start_python_core() -> Result<(), String> {
    let root = project_root();
    let main_py = root.join("python-core").join("main.py");
    Command::new("py")
        .args(["-3.11", main_py.to_str().unwrap_or("python-core/main.py")])
        .current_dir(&root)
        .spawn()
        .or_else(|_| {
            Command::new("python")
                .args([main_py.to_str().unwrap_or("python-core/main.py")])
                .current_dir(&root)
                .spawn()
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Inject a fake command into the pipeline log for debugging purposes.
/// Writes a special entry that the Python core picks up via a trigger file.
#[tauri::command]
fn test_command(cmd: String) -> Result<(), String> {
    let trigger = project_root()
        .join("python-core")
        .join("models")
        .join("test_cmd.txt");
    fs::create_dir_all(trigger.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&trigger, &cmd).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_logs() -> Result<Vec<Value>, String> {
    let path = project_root()
        .join("python-core")
        .join("models")
        .join("logs.jsonl");
    if !path.exists() {
        return Ok(vec![]);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let entries: Vec<Value> = raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    // Return last 60 entries
    let start = entries.len().saturating_sub(60);
    Ok(entries[start..].to_vec())
}

#[tauri::command]
fn read_memory() -> Result<Value, String> {
    let path = project_root()
        .join("python-core")
        .join("models")
        .join("memory.json");
    if !path.exists() {
        return Ok(json!({}));
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_notes() -> Result<Vec<Note>, String> {
    let conn = open_notes_db()?;
    let mut stmt = conn
        .prepare("SELECT id, text, created_at, done FROM notes ORDER BY id DESC LIMIT 60")
        .map_err(|e| e.to_string())?;
    let notes: Vec<Note> = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                done: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(notes)
}

#[tauri::command]
fn add_note(text: String) -> Result<(), String> {
    let conn = open_notes_db()?;
    let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO notes (text, created_at, done) VALUES (?1, ?2, 0)",
        params![text, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_note(id: i64) -> Result<(), String> {
    let conn = open_notes_db()?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn mark_note_done(id: i64) -> Result<(), String> {
    let conn = open_notes_db()?;
    conn.execute("UPDATE notes SET done = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn check_python_ready() -> bool {
    let flag = project_root()
        .join("python-core")
        .join("models")
        .join("python_ready.flag");
    if let Ok(contents) = fs::read_to_string(&flag) {
        contents.trim() == "1"
    } else {
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            start_python_core,
            read_memory,
            read_notes,
            add_note,
            delete_note,
            mark_note_done,
            read_logs,
            test_command,
            check_python_ready
        ])
        .setup(|app| {
            // Use one icon source for both the main window and tray icon.
            let app_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(app_icon.clone());
            }

            let show_i = MenuItem::with_id(app, "show", "Настройки", true, None::<&str>)?;
            let start_i = MenuItem::with_id(app, "start", "Запустить ядро", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &start_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app_icon.clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "start" => {
                        let _ = start_python_core();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {}
        });
}
