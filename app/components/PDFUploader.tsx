import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';

interface PDFUploaderProps {
  onFileUpload: (file: File) => void;
  onUploadComplete: (success: boolean) => void;
}

export function PDFUploader({ onFileUpload, onUploadComplete }: PDFUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      onUploadComplete(false);
      return;
    }

    try {
      setError(null);
      setUploadProgress(0);
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      await onFileUpload(file);
      clearInterval(interval);
      setUploadProgress(100);
      onUploadComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      onUploadComplete(false);
    }
  }, [onFileUpload, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload PDF</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the PDF file here...</p>
          ) : (
            <div>
              <p>Drag and drop a PDF file here, or click to select</p>
              <p className="text-sm text-gray-500 mt-2">Only PDF files are accepted</p>
            </div>
          )}
        </div>

        {uploadProgress > 0 && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-center mt-2">{uploadProgress}%</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 