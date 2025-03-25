import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Progress } from './ui/progress';
import { AlertDialog } from './ui/alert-dialog';

export function PDFRepairTool() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [repairDetails, setRepairDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setStatus('uploading');
    setProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('pdf', file);

      // Upload and process PDF
      const response = await fetch('/api/repair-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      setRepairDetails(result);
      setStatus('complete');
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div 
        {...getRootProps()} 
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer"
        data-testid="dropzone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        <p>Drag & drop a PDF file here, or click to select one</p>
      </div>

      {status !== 'idle' && (
        <div className="mt-4">
          <Progress 
            value={progress} 
            className="w-full" 
            data-testid="upload-progress"
          />
        </div>
      )}

      {status === 'uploading' && (
        <div data-testid="upload-status" className="mt-2 text-center">
          Uploading PDF...
        </div>
      )}

      {status === 'processing' && (
        <div data-testid="repair-status" className="mt-2 text-center">
          Repairing PDF...
        </div>
      )}

      {status === 'complete' && (
        <>
          <div data-testid="upload-success" className="mt-4 p-4 bg-green-50 text-green-700 rounded">
            PDF processed successfully
          </div>
          
          {repairDetails && (
            <div data-testid="repair-details" className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold">Repair Details</h3>
              <div className="mt-2">
                <p>Validation: {repairDetails.validation ? 'Passed' : 'Failed'}</p>
                {repairDetails.repairs && repairDetails.repairs.length > 0 && (
                  <div className="mt-2">
                    <p>Repairs made:</p>
                    <ul className="list-disc pl-5">
                      {repairDetails.repairs.map((repair: string, index: number) => (
                        <li key={index}>{repair}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => {/* Download logic */}}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            data-testid="download-button"
          >
            Download Repaired PDF
          </button>
        </>
      )}

      {status === 'error' && (
        <AlertDialog 
          data-testid="error-message"
          title="Error"
          description={error || 'An unknown error occurred'}
          onClose={() => setStatus('idle')}
        />
      )}
    </div>
  );
} 