import eyeCyan from '../assets/eyes/eye-cyan.png';
import eyeBlue from '../assets/eyes/eye-blue.png';
import eyeGreen from '../assets/eyes/eye-green.png';
import eyeRed from '../assets/eyes/eye-red.png';
import eyePurple from '../assets/eyes/eye-purple.png';
import eyeYellow from '../assets/eyes/eye-yellow.png';
import eyeOrange from '../assets/eyes/eye-orange.png';
import eyePink from '../assets/eyes/eye-pink.png';

export const ACCENT_COLORS: string[] = [
  '#00B4D8', '#3A86FF', '#06D6A0',
  '#FF4D6D', '#9B5DE5', '#FFD60A', '#FB5607', '#FF79C6',
];

const EYE_BY_ACCENT: Record<string, string> = {
  '#00B4D8': eyeCyan,
  '#3A86FF': eyeBlue,
  '#06D6A0': eyeGreen,
  '#FF4D6D': eyeRed,
  '#9B5DE5': eyePurple,
  '#FFD60A': eyeYellow,
  '#FB5607': eyeOrange,
  '#FF79C6': eyePink,
};

export function eyeSrcForAccent(hex?: string): string {
  return EYE_BY_ACCENT[hex ?? ''] ?? eyeCyan;
}
