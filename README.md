# Cross Stitch Pattern Generator

A web application that converts images into cross stitch patterns using DMC embroidery floss colors.

## Features

- **Image Upload**: Upload PNG or JPEG images via drag-and-drop or file picker
- **Image Cropping**: Crop your image before generating the pattern
- **Transparency Support**: PNG transparent pixels are treated as empty stitches
- **Color Matching**: Automatically matches image colors to the closest DMC floss colors
- **Adjustable Pattern Size**: Set width and height in stitches with aspect ratio locked automatically
- **Max Color Limit**: Cap the number of distinct DMC colors used in the pattern
- **Cloth Count**: Set your fabric's count (e.g. 14-count aida) to calculate real-world dimensions
- **Multiple View Modes**: Switch between Color, Cross Stitch (X), and Symbol views
- **Zoom Controls**: Zoom in/out on the pattern display
- **Resizable Sidebar**: Drag the sidebar divider to give more room to the pattern
- **Customizable Color Library**: Add, edit, and remove DMC colors from the active palette
- **Pattern Key**: At-a-glance legend mapping each symbol to its DMC color
- **Print Preview**: Multi-page printable output including the symbol pattern (with page/section rulers), a color preview page, and a shopping list of required thread colors
- **Real-time Preview**: Pattern regenerates automatically as you adjust settings; cancel mid-generation if needed

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

## Usage

1. **Upload an Image**: Click "Browse Files" or drag and drop an image onto the upload area
2. **Crop**: Adjust the crop region, then confirm to proceed
3. **Adjust Pattern Size**: Use the controls to set width and height in stitches
4. **Set Max Colors & Cloth Count**: Limit the palette size and set your fabric count for real-world sizing
5. **Switch Views**: Toggle between Color, Cross Stitch, and Symbol view modes
6. **Customize Colors**: Open the Color Library to add, edit, or remove DMC colors
7. **Print**: Click "Print Pattern" to open a print-ready multi-page preview with the pattern grid, color reference, and shopping list

## How It Works

- The HTML5 Canvas API resizes and processes the uploaded image
- Each pixel is matched to the nearest DMC color using Euclidean distance in RGB space
- For PNG images, transparent pixels (alpha < 128) become empty stitches
- Pattern generation runs cancelably in the background — a Stop button appears while it runs

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technologies Used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- lucide-react
- HTML5 Canvas API

## License

GNU General Public License v3.0

---
*Last updated: June 2026*
