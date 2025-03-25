import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  IconButton,
  LinearProgress,
  Grid,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useTheme } from '../styles/theme';
import { PDFPreview } from './PDFPreview';
import { BatchProcessor, BatchJob } from '../lib/batchProcessing';
import { formatFileSize } from '../utils/fileUtils';

interface BatchProcessingProps {
  onComplete?: (results: BatchJob[]) => void;
  onError?: (error: Error) => void;
}

export const BatchProcessing: React.FC<BatchProcessingProps> = ({
  onComplete,
  onError,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { isDarkMode } = useTheme();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter out non-PDF files
    const pdfFiles = acceptedFiles.filter(
      file => file.type === 'application/pdf'
    );

    // Check file size limits
    const validFiles = pdfFiles.filter(file => file.size <= 500 * 1024 * 1024);

    if (validFiles.length !== acceptedFiles.length) {
      setErrors(prev => ({
        ...prev,
        size: 'Some files exceeded the 500MB size limit',
      }));
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFile === files[index]) {
      setSelectedFile(null);
    }
  };

  const startProcessing = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setErrors({});
    setPaused(false);

    try {
      const processor = new BatchProcessor('./data/reports');

      // Add all files to the processor
      const jobs = files.map(file => ({
        id: file.name,
        file,
        status: 'queued' as const,
      }));

      processor.on('progress', ({ jobId, progress }) => {
        setProgress(prev => ({
          ...prev,
          [jobId]: progress,
        }));
      });

      processor.on('error', ({ jobId, error }) => {
        setErrors(prev => ({
          ...prev,
          [jobId]: error.message,
        }));
      });

      const results = await processor.processFiles(jobs);

      if (onComplete) {
        onComplete(results);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Processing failed');
      setErrors(prev => ({
        ...prev,
        general: err.message,
      }));
      if (onError) {
        onError(err);
      }
    } finally {
      setProcessing(false);
    }
  };

  const pauseProcessing = () => {
    setPaused(true);
    // Implement pause logic
  };

  const resumeProcessing = () => {
    setPaused(false);
    // Implement resume logic
  };

  const stopProcessing = () => {
    setProcessing(false);
    setPaused(false);
    // Implement stop logic
  };

  const totalProgress = files.length > 0
    ? Object.values(progress).reduce((sum, p) => sum + p, 0) / files.length
    : 0;

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Batch Upload Area */}
      <Card
        sx={{
          bgcolor: isDarkMode ? 'background.paper' : 'background.default',
          mb: 3,
        }}
      >
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Batch PDF Processing
          </Typography>
          
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.400',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              mb: 2,
            }}
          >
            <input {...getInputProps()} />
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography>
              {isDragActive
                ? 'Drop PDFs here'
                : 'Drag & drop PDFs here, or click to select files'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Maximum 500MB per file
            </Typography>
          </Box>

          {/* Error Messages */}
          {Object.entries(errors).map(([key, error]) => (
            <Alert severity="error" key={key} sx={{ mb: 2 }}>
              {error}
            </Alert>
          ))}

          {/* File List */}
          <List>
            {files.map((file, index) => (
              <ListItem
                key={file.name}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => setSelectedFile(file)}
              >
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs={6}>
                    <Typography noWrap>{file.name}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography color="textSecondary">
                      {formatFileSize(file.size)}
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <LinearProgress
                      variant="determinate"
                      value={progress[file.name] || 0}
                      sx={{ width: '100%' }}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <Tooltip title="Remove file">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>

          {/* Control Buttons */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<StartIcon />}
              onClick={startProcessing}
              disabled={files.length === 0 || processing}
            >
              Start Processing
            </Button>
            
            {processing && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={paused ? <StartIcon /> : <PauseIcon />}
                  onClick={paused ? resumeProcessing : pauseProcessing}
                >
                  {paused ? 'Resume' : 'Pause'}
                </Button>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={stopProcessing}
                >
                  Stop
                </Button>
              </>
            )}
          </Box>

          {/* Overall Progress */}
          {processing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Overall Progress
              </Typography>
              <LinearProgress
                variant="determinate"
                value={totalProgress}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="textSecondary" align="right">
                {Math.round(totalProgress)}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* File Preview */}
      {selectedFile && (
        <Card
          sx={{
            bgcolor: isDarkMode ? 'background.paper' : 'background.default',
          }}
        >
          <CardContent>
            <PDFPreview
              file={selectedFile}
              onError={(error) =>
                setErrors(prev => ({
                  ...prev,
                  preview: error.message,
                }))
              }
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}; 