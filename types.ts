
export enum AppMode {
  HOME = 'HOME',
  COMPRESSOR = 'COMPRESSOR',
  CONVERTER = 'CONVERTER',
  PDF_EDITOR = 'PDF_EDITOR',
  COMPARE = 'COMPARE',
  TEXT_COMPARE = 'TEXT_COMPARE',
}

export enum AiAction {
  SUMMARIZE = 'SUMMARIZE',
  TRANSLATE_EN = 'TRANSLATE_EN',
  TRANSLATE_TR = 'TRANSLATE_TR',
  PROOFREAD = 'PROOFREAD',
}

export interface FileWithPreview extends File {
  preview?: string;
  id: string;
}

export interface CompressedResult {
  originalSize: number;
  compressedSize: number;
  blob: Blob;
  url: string;
  name: string;
}

export interface Annotation {
  id: string;
  type: 'text' | 'erase' | 'line' | 'highlight' | 'image';
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage
  height: number; // Percentage
  
  // Text specific
  content?: string; 
  originalContent?: string;
  fontSize?: number; // Natural preview pixels; convert using page display/preview height for pt
  fontFamily?: 'Helvetica' | 'Times New Roman' | 'Courier';
  isBold?: boolean;
  isItalic?: boolean;
  rotation?: number; // Clockwise degrees in the rendered page
  baseline?: number; // Baseline offset in natural preview pixels
  source?: 'native' | 'ocr';
  confidence?: number;
  detectedFont?: string;
  sourceFont?: string;
  sourceGlyphHeight?: number;
  textStyle?: { width: number; height: number }; // Fixed source calibration, inherited by new text
  useSourceMetrics?: boolean;
  detectedBounds?: { x: number; y: number; width: number; height: number };
  original?: {
    x: number; y: number; width: number; height: number;
    content: string; fontSize?: number; fontFamily?: Annotation['fontFamily'];
    isBold?: boolean; isItalic?: boolean; color?: string;
    rotation?: number; baseline?: number;
    backgroundColor?: string; textBackgroundColor?: string; opacity?: number;
  };
  maskColor?: string;
  maskPadding?: number; // Natural preview pixels, including glyph overhang
  isDeleted?: boolean;
  
  // Image specific (Stamp/QR)
  imageData?: string; // Base64 data url
  
  // Style properties
  color?: string; 
  backgroundColor?: string; 
  textBackgroundColor?: string; 
  opacity?: number; 
  lineWidth?: number; 
  
  // System
  isInteractive?: boolean; 
}

export interface PdfPage {
  uniqueId: string;
  sourceFileIndex: number;
  originalPageIndex: number;
  preview: string;
  rotation: number;
  isDeleted: boolean;
  annotations: Annotation[];
  previewWidth?: number;
  previewHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  viewportTransform?: number[];
  ocrComplete?: boolean;
}