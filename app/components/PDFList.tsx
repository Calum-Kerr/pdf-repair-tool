import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface PDF {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: 'processing' | 'completed' | 'failed';
}

interface PDFListProps {
  pdfs?: PDF[];
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PDFList({ pdfs = [], onDownload, onDelete }: PDFListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploaded PDFs</CardTitle>
      </CardHeader>
      <CardContent>
        {pdfs.length === 0 ? (
          <p className="text-center text-gray-500">No PDFs uploaded yet</p>
        ) : (
          <div className="space-y-4">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <h3 className="font-medium">{pdf.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(pdf.size)} • {formatDate(pdf.uploadDate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {pdf.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDownload(pdf.id)}
                    >
                      Download
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(pdf.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 