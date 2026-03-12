# Pixel Flow

A aspirational powerful, node-based(yet) creative coding environment for image manipulation, ASCII art generation, and procedural effects.
Eventually I want to make assitive ai image editing tool using this.
And node based evironment being manged by a prompt based node engine, that is yet to built. 

Pixel Flow allows you to build complex image processing pipelines using a visual node editor. Connect inputs to filters, edge detectors, and ASCII converters to create stunning digital art in real-time.

---

##  Key Features

### 🎨Artistic Nodes
- **ASCII Art Node**: Transform images into character-based art with customizable font sizes, character sets (Classic, Blocks, Minimal, Braille), and cell-level masking.
- **Canny Edge Node**: A multi-stage edge detection algorithm that produces clean, high-contrast outlines.
- **Filter Node**: Apply classic effects like Blur, Sharpen, Emboss, and High Pass.
- **Color Node**: Fine-tune saturation, brightness, and contrast.
- **Blend Node**: Combine layers using various blend modes (Normal, Multiply, Screen, Overlay, etc.).

###  Advanced Masking
- **Mask Editor Node**: A full-featured drawing tool with Brush (✦) and Eraser (◌) modes.
- **Smart Loading**: Connect a Canny Edge node directly to the Mask input to use generated edges as a starting point for manual refinement.
- **Precision**: ASCII art respects masks at the character-cell level, ensuring sharp transitions.

### ⚙️ Engine & Architecture
- **Real-time Pipeline**: Topologically sorted execution ensures changes propagate instantly through the graph.
- **Web-First**: Built with high-performance `OffscreenCanvas` and `ImageBitmap` for smooth 60fps interaction.
- **Transparent Output**: Generate transparent ASCII art for easy blending and compositing.

---

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/pixel-flow.git
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
5. **Output**: Connect the final result to an `Output` node to view and save.

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
