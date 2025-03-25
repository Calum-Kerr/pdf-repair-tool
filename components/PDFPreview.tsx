import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Grid, Box, CircularProgress } from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useTheme } from '../styles/theme';
import { mediaQueries, spacing } from '../styles/responsive';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFPreviewProps {
  file: File | null;
  onError?: (error: Error) => void;
}

interface PDFInfo {
  numPages: number;
  title?: string;
  author?: string;
  creationDate?: string;
  fileSize: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ file, onError }) => {
  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDarkMode } = useTheme();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  useEffect(() => {
    const loadPDFInfo = async () => {
      if (!file) {
        setPdfInfo(null);
        setThumbnails([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Load PDF document
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        // Get document metadata
        const metadata = await pdf.getMetadata();

        // Generate thumbnails for first 3 pages
        const thumbs: string[] = [];
        const maxThumbnails = Math.min(3, pdf.numPages);
        
        for (let i = 1; i <= maxThumbnails; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (context) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;
            
            thumbs.push(canvas.toDataURL());
          }
        }

        setPdfInfo({
          numPages: pdf.numPages,
          title: metadata.info?.Title || file.name,
          author: metadata.info?.Author || 'Unknown',
          creationDate: metadata.info?.CreationDate 
            ? new Date(metadata.info.CreationDate).toLocaleDateString()
            : 'Unknown',
          fileSize: formatFileSize(file.size),
        });
        
        setThumbnails(thumbs);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load PDF');
        setError(error.message);
        if (onError) {
          onError(error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPDFInfo();
  }, [file, onError]);

  if (!file) {
    return null;
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Card sx={{ bgcolor: isDarkMode ? 'error.dark' : 'error.light', p: 2 }}>
        <Typography color="error">
          Error loading PDF: {error}
        </Typography>
      </Card>
    );
  }

  if (!pdfInfo) {
    return null;
  }

  return (
    <Card sx={{
      p: { xs: 2, sm: 3 },
      bgcolor: isDarkMode ? 'background.paper' : 'background.default',
    }}>
      <CardContent>
        <Grid container spacing={3}>
          {/* PDF Information */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Document Information
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography><strong>Title:</strong> {pdfInfo.title}</Typography>
              <Typography><strong>Author:</strong> {pdfInfo.author}</Typography>
              <Typography><strong>Created:</strong> {pdfInfo.creationDate}</Typography>
              <Typography><strong>Pages:</strong> {pdfInfo.numPages}</Typography>
              <Typography><strong>Size:</strong> {pdfInfo.fileSize}</Typography>
            </Box>
          </Grid>

          {/* Thumbnails */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Preview
            </Typography>
            <Grid container spacing={2}>
              {thumbnails.map((thumbnail, index) => (
                <Grid item xs={12} sm={4} key={index}>
                  <Box
                    component="img"
                    src={thumbnail}
                    alt={`Page ${index + 1}`}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: 1,
                      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}; 