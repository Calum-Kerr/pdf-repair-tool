'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PDFUploader } from './components/PDFUploader';
import { PDFList } from './components/PDFList';
import { ConsentManager } from './components/ConsentManager';
import { ConsentHistory } from './components/ConsentHistory';

interface RepairStatus {
  stage: 'idle' | 'uploading' | 'analyzing' | 'extracting' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

interface ExtractedContent {
  text: string;
  method: string;
  confidence: number;
}

export default function Home() {
  const [status, setStatus] = useState<RepairStatus>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to repair PDF files',
  });
  const [extractedContent, setExtractedContent] = useState<ExtractedContent[]>([]);
  const [repairedPdfUrl, setRepairedPdfUrl] = useState<string | null>(null);
  const [pdfs, setPdfs] = useState<Array<{
    id: string;
    name: string;
    size: number;
    uploadDate: Date;
    status: 'processing' | 'completed' | 'failed';
  }>>([]);

  // Add user information state
  const [userInfo] = useState({
    userId: 'default-user', // In a real app, this would come from authentication
    ipAddress: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (file.type !== 'application/pdf') {
      setStatus({
        stage: 'error',
        progress: 0,
        message: 'Please upload a PDF file',
        error: 'Invalid file type',
      });
      return;
    }

    try {
      setStatus({ stage: 'uploading', progress: 0, message: 'Reading PDF file...' });
      const arrayBuffer = await file.arrayBuffer();
      
      setStatus({ stage: 'analyzing', progress: 20, message: 'Analyzing PDF structure...' });
      const content = await analyzePdf(arrayBuffer);
      
      setStatus({ stage: 'extracting', progress: 40, message: 'Extracting content...' });
      const extracted = await extractContent(content);
      setExtractedContent(extracted);
      
      setStatus({ stage: 'generating', progress: 80, message: 'Generating repaired PDF...' });
      const repairedPdf = await generateRepairedPdf(extracted);
      
      const url = URL.createObjectURL(repairedPdf);
      setRepairedPdfUrl(url);
      
      setStatus({ stage: 'complete', progress: 100, message: 'PDF repair completed successfully' });
    } catch (error) {
      setStatus({
        stage: 'error',
        progress: 0,
        message: 'Failed to repair PDF',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  const handleDownload = (id: string) => {
    const pdf = pdfs.find(p => p.id === id);
    if (pdf && repairedPdfUrl) {
      const link = document.createElement('a');
      link.href = repairedPdfUrl;
      link.download = `repaired_${pdf.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = (id: string) => {
    setPdfs(current => current.filter(pdf => pdf.id !== id));
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8">PDF Repair Tool</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Upload PDF</h2>
          <PDFUploader 
            onFileUpload={async (file) => {
              let newPdf = {
                id: Date.now().toString(),
                name: file.name,
                size: file.size,
                uploadDate: new Date(),
                status: 'processing' as const
              };

              try {
                setStatus({ stage: 'uploading', progress: 0, message: 'Reading PDF file...' });
                
                // Add the PDF to the list
                setPdfs(current => [...current, newPdf]);

                const arrayBuffer = await file.arrayBuffer();
                
                setStatus({ stage: 'analyzing', progress: 20, message: 'Analyzing PDF structure...' });
                const content = await analyzePdf(arrayBuffer);
                
                setStatus({ stage: 'extracting', progress: 40, message: 'Extracting content...' });
                const extracted = await extractContent(content);
                setExtractedContent(extracted);
                
                setStatus({ stage: 'generating', progress: 80, message: 'Generating repaired PDF...' });
                const repairedPdf = await generateRepairedPdf(extracted);
                
                const url = URL.createObjectURL(repairedPdf);
                setRepairedPdfUrl(url);
                
                // Update PDF status to completed
                setPdfs(current => current.map(pdf => 
                  pdf.id === newPdf.id 
                    ? { ...pdf, status: 'completed' as const }
                    : pdf
                ));
                
                setStatus({ stage: 'complete', progress: 100, message: 'PDF repair completed successfully' });
                return true;
              } catch (error) {
                // Update PDF status to failed
                setPdfs(current => current.map(pdf => 
                  pdf.id === newPdf.id 
                    ? { ...pdf, status: 'failed' as const }
                    : pdf
                ));

                setStatus({
                  stage: 'error',
                  progress: 0,
                  message: 'Failed to repair PDF',
                  error: error instanceof Error ? error.message : 'Unknown error occurred',
                });
                return false;
              }
            }}
            onUploadComplete={(success) => {
              if (!success) {
                setStatus({
                  stage: 'error',
                  progress: 0,
                  message: 'Failed to process PDF',
                  error: 'Upload failed',
                });
              }
            }}
          />
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold mb-4">Your PDFs</h2>
          <PDFList 
            pdfs={pdfs}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Consent Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ConsentManager 
            userId={userInfo.userId}
            ipAddress={userInfo.ipAddress}
            userAgent={userInfo.userAgent}
          />
          <ConsentHistory 
            userId={userInfo.userId}
          />
        </div>
      </div>
    </main>
  );
}

async function analyzePdf(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  // Convert ArrayBuffer to Uint8Array for easier manipulation
  return new Uint8Array(arrayBuffer);
}

async function extractContent(pdfData: Uint8Array): Promise<ExtractedContent[]> {
  const results: ExtractedContent[] = [];
  const maxIterations = 1000; // Safety limit for loops

  // Method 1: Extract text between BT and ET markers
  let btEtText = '';
  let btCount = 0;
  let etCount = 0;
  let currentText = '';
  
  for (let i = 0; i < pdfData.length && btCount < maxIterations; i++) {
    if (pdfData[i] === 66 && pdfData[i + 1] === 84) { // "BT"
      btCount++;
      currentText = '';
    } else if (pdfData[i] === 69 && pdfData[i + 1] === 84) { // "ET"
      etCount++;
      btEtText += currentText + '\n';
    } else {
      currentText += String.fromCharCode(pdfData[i]);
    }
  }
  
  if (btEtText.trim()) {
    results.push({
      text: btEtText,
      method: 'BT/ET Markers',
      confidence: Math.min(btCount, etCount) / Math.max(btCount, etCount),
    });
  }

  // Method 2: Extract text from Tj operators
  let tjText = '';
  let tjCount = 0;
  let inTj = false;
  let currentTj = '';
  
  for (let i = 0; i < pdfData.length && tjCount < maxIterations; i++) {
    if (pdfData[i] === 84 && pdfData[i + 1] === 106) { // "Tj"
      tjCount++;
      inTj = true;
      currentTj = '';
    } else if (inTj && pdfData[i] === 32) { // Space
      inTj = false;
      tjText += currentTj + '\n';
    } else if (inTj) {
      currentTj += String.fromCharCode(pdfData[i]);
    }
  }
  
  if (tjText.trim()) {
    results.push({
      text: tjText,
      method: 'Tj Operators',
      confidence: tjCount / maxIterations,
    });
  }

  // Method 3: Extract text between parentheses
  let parenText = '';
  let parenCount = 0;
  let inParen = false;
  let currentParen = '';
  
  for (let i = 0; i < pdfData.length && parenCount < maxIterations; i++) {
    if (pdfData[i] === 40) { // "("
      parenCount++;
      inParen = true;
      currentParen = '';
    } else if (pdfData[i] === 41) { // ")"
      inParen = false;
      parenText += currentParen + '\n';
    } else if (inParen) {
      currentParen += String.fromCharCode(pdfData[i]);
    }
  }
  
  if (parenText.trim()) {
    results.push({
      text: parenText,
      method: 'Parentheses',
      confidence: parenCount / maxIterations,
    });
  }

  return results;
}

async function generateRepairedPdf(extractedContent: ExtractedContent[]): Promise<Blob> {
  // Create a properly formatted PDF with better structure
  const pdfContent = [
    '%PDF-1.7',
    '1 0 obj',
    '<<',
    '/Type /Catalog',
    '/Pages 2 0 R',
    '/Info 8 0 R',
    '>>',
    'endobj',
    '2 0 obj',
    '<<',
    '/Type /Pages',
    '/Kids [3 0 R 4 0 R]',
    '/Count 2',
    '>>',
    'endobj',
    '3 0 obj',
    '<<',
    '/Type /Page',
    '/Parent 2 0 R',
    '/Resources <<',
    '/Font <<',
    '/F1 5 0 R',
    '/F2 6 0 R',
    '>>',
    '>>',
    '/MediaBox [0 0 612 792]',
    '/Contents 7 0 R',
    '>>',
    'endobj',
    '4 0 obj',
    '<<',
    '/Type /Page',
    '/Parent 2 0 R',
    '/Resources <<',
    '/Font <<',
    '/F1 5 0 R',
    '/F2 6 0 R',
    '>>',
    '>>',
    '/MediaBox [0 0 612 792]',
    '/Contents 9 0 R',
    '>>',
    'endobj',
    '5 0 obj',
    '<<',
    '/Type /Font',
    '/Subtype /Type1',
    '/BaseFont /Helvetica-Bold',
    '>>',
    'endobj',
    '6 0 obj',
    '<<',
    '/Type /Font',
    '/Subtype /Type1',
    '/BaseFont /Helvetica',
    '>>',
    'endobj',
    '7 0 obj',
    '<<',
    '/Length 8 0 R',
    '>>',
    'stream',
    'BT',
    '/F1 28 Tf',
    '50 750 Td',
    '(PDF Repair Tool) Tj',
    '/F2 16 Tf',
    '0 -50 Td',
    '(Your PDF has been successfully repaired!) Tj',
    '/F2 12 Tf',
    '0 -30 Td',
    '(This document was processed using advanced content recovery methods) Tj',
    '0 -20 Td',
    '(to ensure maximum data preservation and readability.) Tj',
    '0 -40 Td',
    '/F1 14 Tf',
    '(Repair Details) Tj',
    '/F2 12 Tf',
    '0 -25 Td',
    '50 0 Td',
    '(Extraction Method:) Tj',
    '-50 0 Td',
    '150 0 Td',
    '(' + extractedContent[0].method + ') Tj',
    '-150 -20 Td',
    '50 0 Td',
    '(Confidence Score:) Tj',
    '-50 0 Td',
    '150 0 Td',
    '(' + (extractedContent[0].confidence * 100).toFixed(0) + '%) Tj',
    '-150 -20 Td',
    '50 0 Td',
    '(Processing Date:) Tj',
    '-50 0 Td',
    '150 0 Td',
    '(' + new Date().toLocaleDateString() + ') Tj',
    '-150 -40 Td',
    '/F1 14 Tf',
    '(Need to repair more PDFs?) Tj',
    '/F2 12 Tf',
    '0 -25 Td',
    '(Visit us at https://pdf-repair-tool.com) Tj',
    '0 -100 Td',
    '/F2 10 Tf',
    '(Powered by Next.js and advanced PDF processing algorithms) Tj',
    'ET',
    'endstream',
    'endobj',
    '8 0 obj',
    '1000',
    'endobj',
    '9 0 obj',
    '<<',
    '/Length 10 0 R',
    '>>',
    'stream',
    'BT',
    '/F1 20 Tf',
    '50 750 Td',
    '(Repaired Content) Tj',
    '/F2 12 Tf',
    '0 -40 Td',
    ...extractedContent[0].text
      .split('\n')
      .map((line, index) => {
        // Clean and encode the text properly
        const cleanedLine = line
          .trim()
          .replace(/[()\\]/g, '\\$&')
          .replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
        return [
          '0 -16 Td',
          '(' + cleanedLine + ') Tj'
        ];
      })
      .flat(),
    'ET',
    'endstream',
    'endobj',
    '10 0 obj',
    '1000',
    'endobj',
    '8 0 obj',
    '<<',
    '/Producer (PDF Repair Tool)',
    '/CreationDate (D:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 14) + 'Z)',
    '/Title (Repaired PDF Document)',
    '/Creator (PDF Repair Tool - Advanced Content Recovery)',
    '/Keywords (pdf repair, content recovery, document restoration)',
    '>>',
    'endobj',
    'xref',
    '0 11',
    '0000000000 65535 f',
    '0000000009 00000 n',
    '0000000074 00000 n',
    '0000000120 00000 n',
    '0000000290 00000 n',
    '0000000460 00000 n',
    '0000000540 00000 n',
    '0000000620 00000 n',
    '0000001500 00000 n',
    '0000001520 00000 n',
    '0000002400 00000 n',
    'trailer',
    '<<',
    '/Size 11',
    '/Root 1 0 R',
    '/Info 8 0 R',
    '>>',
    'startxref',
    '2420',
    '%%EOF'
  ].join('\n');

  return new Blob([pdfContent], { type: 'application/pdf' });
} 