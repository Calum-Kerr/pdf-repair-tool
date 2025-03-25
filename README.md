# PDF Repair Tool

A Next.js web application that allows users to upload potentially corrupted PDF files and repair them without relying on external libraries. The application provides real-time visual feedback during the repair process and handles a wide range of PDF corruption scenarios.

## Features

- Drag-and-drop interface for uploading PDF files
- Multiple content extraction methods to handle various corruption scenarios
- Real-time progress tracking and status updates
- Content preview with confidence scores
- Download repaired PDFs
- Detailed repair process information

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pdf-repair-tool.git
cd pdf-repair-tool
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Drag and drop a corrupted PDF file onto the upload area or click to select a file
2. Wait for the repair process to complete
3. Review the extracted content in the "Content" tab
4. Check the repair process details in the "Details" tab
5. Download the repaired PDF using the download button

## Technical Details

The application uses multiple methods to extract text from corrupted PDFs:

1. BT/ET Markers: Extracts text between Begin Text and End Text markers
2. Tj Operators: Extracts text from PDF text operators
3. Parentheses: Extracts text between parentheses with filtering

Each extraction method provides a confidence score based on the quality of the extracted content.

## Safety Features

The application follows strict safety guidelines:

- Bounded loops with maximum iteration limits
- No dynamic memory allocation after initialization
- Strict type checking
- Comprehensive error handling
- Simple control flow
- Limited pointer usage

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.