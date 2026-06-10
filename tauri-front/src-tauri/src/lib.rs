use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{include_image, Manager, RunEvent};

const TRAY_ICON: tauri::image::Image<'static> = include_image!("icons/taskbar-icon.png");
const WINDOW_ICON: tauri::image::Image<'static> = include_image!("icons/window-icon.png");

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
    llm_backend: String,
    ollama_url: String,
    ollama_model: String,
    ollama_think: bool,
    ollama_timeout_sec: i64,
    use_ollama_tools: bool,
    use_ollama_wake: bool,
    use_ollama_responses: bool,
    use_ollama_chat: bool,
    use_camb_tts: bool,
    camb_api_key: String,
    camb_voice_id: i64,
    camb_language: String,
    camb_speech_model: String,
    tts_backend: String,
    use_gemini_route: bool,
    use_gemini_wake: bool,
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
    if let Ok(root) = std::env::var("CONNOR_ROOT") {
        let p = PathBuf::from(root);
        if p.join("config.json").exists() || p.join("python-core").join("main.py").exists() {
            return p;
        }
    }
    let mut p = std::env::current_exe().unwrap_or_default();
    for _ in 0..8 {
        p.pop();
        if p.join("config.json").exists() || p.join("python-core").join("main.py").exists() {
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
      "first_launch": true,
      "llm_backend": "ollama",
      "ollama_url": "http://127.0.0.1:11434",
      "ollama_model": "gemma4:e4b",
      "ollama_think": false,
      "ollama_timeout_sec": 45,
      "use_ollama_tools": true,
      "use_ollama_wake": true,
      "use_ollama_responses": true,
      "use_ollama_chat": true,
      "tts_backend": "camb",
      "use_camb_tts": false,
      "camb_api_key": "",
      "camb_voice_id": 147320,
      "camb_language": "ru-ru",
      "camb_speech_model": "mars-8.1-flash-beta",
      "use_gemini_route": false,
      "use_gemini_wake": false
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
        llm_backend: v["llm_backend"].as_str().unwrap_or("ollama").to_string(),
        ollama_url: v["ollama_url"].as_str().unwrap_or("http://127.0.0.1:11434").to_string(),
        ollama_model: v["ollama_model"].as_str().unwrap_or("gemma4:e4b").to_string(),
        ollama_think: v["ollama_think"].as_bool().unwrap_or(false),
        ollama_timeout_sec: v["ollama_timeout_sec"].as_i64().unwrap_or(45),
        use_ollama_tools: v["use_ollama_tools"].as_bool().unwrap_or(true),
        use_ollama_wake: v["use_ollama_wake"].as_bool().unwrap_or(true),
        use_ollama_responses: v["use_ollama_responses"].as_bool().unwrap_or(true),
        use_ollama_chat: v["use_ollama_chat"].as_bool().unwrap_or(true),
        use_camb_tts: v["use_camb_tts"].as_bool().unwrap_or(false),
        camb_api_key: v["camb_api_key"].as_str().unwrap_or("").to_string(),
        camb_voice_id: v["camb_voice_id"].as_i64().unwrap_or(147320),
        camb_language: v["camb_language"].as_str().unwrap_or("ru-ru").to_string(),
        camb_speech_model: v["camb_speech_model"].as_str().unwrap_or("mars-8.1-flash-beta").to_string(),
        tts_backend: v["tts_backend"].as_str().unwrap_or("camb").to_string(),
        use_gemini_route: v["use_gemini_route"].as_bool().unwrap_or(false),
        use_gemini_wake: v["use_gemini_wake"].as_bool().unwrap_or(false),
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

#[cfg(windows)]
fn stop_python_core() {
    let ps = "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'pythonw.exe' -or $_.Name -eq 'python.exe') -and $_.CommandLine -match 'python-core\\\\main\\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps])
        .output();
}

#[cfg(not(windows))]
fn stop_python_core() {}

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

#[derive(Serialize)]
struct SystemStats {
    cpu: f64,
    ram_pct: f64,
    ram_used_gb: f64,
    ram_total_gb: f64,
}

#[tauri::command]
fn get_system_stats() -> SystemStats {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    let cpu: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>()
        / sys.cpus().len().max(1) as f64;
    let total = sys.total_memory() as f64 / 1_073_741_824.0;
    let used = sys.used_memory() as f64 / 1_073_741_824.0;
    let ram_pct = if sys.total_memory() > 0 {
        (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
    } else {
        0.0
    };
    SystemStats {
        cpu: (cpu * 10.0).round() / 10.0,
        ram_pct: (ram_pct * 10.0).round() / 10.0,
        ram_used_gb: (used * 10.0).round() / 10.0,
        ram_total_gb: (total * 10.0).round() / 10.0,
    }
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
            get_system_stats,
            test_command,
            check_python_ready
        ])
        .setup(|app| {
            // Трей = raw as-is | Панель активных = window-icon (zoom центра)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(WINDOW_ICON.clone());
            }

            let show_i = MenuItem::with_id(app, "show", "Настройки", true, None::<&str>)?;
            let start_i = MenuItem::with_id(app, "start", "Запустить ядро", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &start_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(TRAY_ICON.clone())
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
                        stop_python_core();
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
