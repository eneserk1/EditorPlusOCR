
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
  fontSize?: number;
  fontFamily?: 'Helvetica' | 'Times New Roman' | 'Courier';
  isBold?: boolean;
  
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
}