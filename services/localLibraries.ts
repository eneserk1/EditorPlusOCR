// Compatibility for existing tools; all libraries are bundled, with no CDN scripts.
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as Diff from 'diff';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
Object.assign(window, { pdfjsLib: pdfjs, jspdf: { jsPDF }, JSZip, Diff });
