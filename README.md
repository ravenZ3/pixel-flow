# Pixel Flow

An aspirational and powerful node-based creative coding environment for image manipulation, ASCII art generation, and procedural effects.

Pixel Flow allows you to build complex image processing pipelines using a visual node editor. Connect inputs to filters, edge detectors, and ASCII converters to create stunning digital art in real-time.

---

## ✨ Key Features

### 🎨 Artistic Nodes
- **ASCII Art Node**: Transform images into character-based art with customizable font sizes, character sets (Classic, Blocks, Minimal, Braille), and cell-level masking.
- **Canny Edge Node**: A multi-stage edge detection algorithm that produces clean, high-contrast outlines.
- **Filter Node**: Apply classic effects like Blur, Sharpen, Emboss, and High Pass.
- **Color Node**: Fine-tune saturation, brightness, and contrast.
- **Blend Node**: Combine layers using various blend modes (Normal, Multiply, Screen, Overlay, etc.).

### 🔗 Sharing & Persistence
- **Share-by-URL**: Encode your entire graph into a portable URL hash. Share your creations instantly without needing a backend or database.
- **State Hydration**: Graphs are automatically restored from the URL on load, making it easy to bookmark or send your workflows.
- **Privacy-First**: Runtime state like uploaded images and temporary masks are stripped before encoding to keep URLs compact and portable.

### 🖥️ Refined Workspace
- **Smart Sidebar**: Nodes are organized by category (Source, Adjust, Stylize, Generate, Composite, Sink) with color-coded indicators.
- **Search & Templates**: Quickly find nodes or save common configurations as templates for reuse.
- **Adaptive Minimap**: A helpful overview that stays out of your way until your graph grows complex.
- **Canvas Hints**: Interactive overlays guide you when starting with an empty workspace.

### ⚡ Performance & Quality
- **Pyramid Downscaling**: High-fidelity previews using multi-stage downscaling to eliminate moiré patterns and aliasing on dense outputs (ASCII, halftones).
- **Real-time Pipeline**: Topologically sorted execution ensures changes propagate instantly through the graph.
- **Web-First**: Built with high-performance `OffscreenCanvas` and `ImageBitmap` for smooth interaction.
- **DPI Aware**: Canvas elements are automatically optimized for your display's resolution.

---

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ravenZ3/pixel-flow.git
   cd pixel-flow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Basic Workflow

1. **Upload**: Add an `ImageInput` node and upload your source image.
2. **Process**: Add a `Color` or `Filter` node to prep the image.
3. **ASCII**: Connect to an `ASCIINode` to see the magic happen.
4. **Refine**: Use a `MaskNode` to target specific areas of your image for effects.
5. **Share**: Click the **Share** button to copy a link to your current graph to the clipboard.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/)
- **Visual Programming**: [React Flow](https://reactflow.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)

---

## 📜 License

MIT License - feel free to build whatever you want with this!
