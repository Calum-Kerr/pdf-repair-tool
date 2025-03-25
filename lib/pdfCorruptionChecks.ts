import { PDFCorruptionResult } from './types';

const HEADER_CORRUPTION_PATTERNS = [
  /^%PDF-[^1-7]\.[^0-9]/,  // Invalid version number
  /%PDF-\d\.\d.{100,}/,    // Excessive content after header
  /^\s+%PDF/,              // Invalid whitespace before header
];

const XREF_CORRUPTION_PATTERNS = [
  /xref\s*\n(?!\d+\s+\d+\s*\n)/,  // Invalid xref table format
  /\n\d{10}\s[^0-9fn]\s\d{5}/,    // Invalid entry type
  /\n\d{9}[^0-9]\s[0-9fn]\s\d{5}/ // Invalid object number
];

const STREAM_CORRUPTION_PATTERNS = [
  /stream[\s\S]*?endstream/,  // Missing stream length
  /stream(?!\s*\n)/,          // Invalid stream delimiter
  /endstream(?!\s*\n)/        // Invalid endstream delimiter
];

export function checkPDFCorruption(buffer: ArrayBuffer): PDFCorruptionResult {
  const data = new Uint8Array(buffer);
  const text = new TextDecoder().decode(data);
  
  const headerIssues = checkHeaderCorruption(text);
  const xrefIssues = checkXRefCorruption(text);
  const streamIssues = checkStreamCorruption(text);
  
  const isCorrupted = headerIssues.length > 0 || xrefIssues.length > 0 || streamIssues.length > 0;
  
  return {
    isCorrupted,
    corruptions: {
      header: headerIssues,
      xref: xrefIssues,
      streams: streamIssues
    },
    severity: calculateCorruptionSeverity(headerIssues, xrefIssues, streamIssues),
    repairStrategy: determineRepairStrategy(headerIssues, xrefIssues, streamIssues)
  };
}

function checkHeaderCorruption(text: string): string[] {
  const issues: string[] = [];
  
  // Check for basic header presence
  if (!text.startsWith('%PDF-')) {
    issues.push('Missing PDF header');
    return issues;
  }
  
  // Check for specific corruption patterns
  HEADER_CORRUPTION_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(text)) {
      issues.push(`Header corruption detected: Pattern ${index + 1}`);
    }
  });
  
  return issues;
}

function checkXRefCorruption(text: string): string[] {
  const issues: string[] = [];
  
  // Check for xref table presence
  if (!text.includes('\nxref\n')) {
    issues.push('Missing cross-reference table');
    return issues;
  }
  
  // Check for specific xref corruption patterns
  XREF_CORRUPTION_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(text)) {
      issues.push(`Cross-reference corruption detected: Pattern ${index + 1}`);
    }
  });
  
  return issues;
}

function checkStreamCorruption(text: string): string[] {
  const issues: string[] = [];
  
  // Check for stream/endstream pairs
  const streamCount = (text.match(/stream/g) || []).length;
  const endstreamCount = (text.match(/endstream/g) || []).length;
  
  if (streamCount !== endstreamCount) {
    issues.push(`Mismatched stream/endstream pairs: ${streamCount} streams vs ${endstreamCount} endstreams`);
  }
  
  // Check for specific stream corruption patterns
  STREAM_CORRUPTION_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(text)) {
      issues.push(`Stream corruption detected: Pattern ${index + 1}`);
    }
  });
  
  return issues;
}

function calculateCorruptionSeverity(
  headerIssues: string[],
  xrefIssues: string[],
  streamIssues: string[]
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const totalIssues = headerIssues.length + xrefIssues.length + streamIssues.length;
  
  if (headerIssues.length > 0) return 'CRITICAL';
  if (xrefIssues.length > 0) return 'HIGH';
  if (streamIssues.length > 2) return 'HIGH';
  if (streamIssues.length > 0) return 'MEDIUM';
  return 'LOW';
}

function determineRepairStrategy(
  headerIssues: string[],
  xrefIssues: string[],
  streamIssues: string[]
): string[] {
  const strategies: string[] = [];
  
  if (headerIssues.length > 0) {
    strategies.push('Reconstruct PDF header');
  }
  
  if (xrefIssues.length > 0) {
    strategies.push('Rebuild cross-reference table');
  }
  
  if (streamIssues.length > 0) {
    strategies.push('Fix stream delimiters');
    strategies.push('Recalculate stream lengths');
  }
  
  return strategies;
} 