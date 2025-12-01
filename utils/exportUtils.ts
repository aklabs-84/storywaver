import { StoryData } from "../types";
import { jsPDF } from "jspdf";

export const downloadJSON = (data: StoryData, filename: string) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadTextScript = (data: StoryData, filename: string) => {
  let content = `스토리 스크립트: ${filename}\n`;
  content += "====================================\n\n";

  data.nodes.forEach(node => {
    content += `장면: ${node.title} [ID: ${node.id}]\n`;
    content += `------------------------------------\n`;
    content += `${node.content}\n\n`;
    
    const choices = data.links.filter(l => l.source === node.id);
    if (choices.length > 0) {
      content += `선택지:\n`;
      choices.forEach(choice => {
        const target = data.nodes.find(n => n.id === choice.target);
        content += `  - [${choice.label}] -> 이동: "${target?.title || choice.target}"\n`;
      });
    } else {
      content += `(분기 종료)\n`;
    }
    content += "\n====================================\n\n";
  });

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper function to convert SVG to Canvas with Full Map Support
const svgToCanvas = (svgElement: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    // 1. Get the content bounding box from the original SVG (before cloning)
    // The first <g> is usually the zoom container in our D3 setup
    const contentGroup = svgElement.querySelector('g'); 
    if (!contentGroup) {
        reject(new Error("Graph content not found (no <g> element)."));
        return;
    }
    
    // getBBox() returns the bounding box of the content in user coordinates (ignoring transform)
    // This allows us to know the full size of the graph even if the user is zoomed in
    const bbox = (contentGroup as SVGGraphicsElement).getBBox();
    
    // Add some padding
    const padding = 50;
    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;
    
    // Avoid tiny images if bbox is invalid
    if (width <= 0 || height <= 0) {
        reject(new Error("Graph is empty or not rendered."));
        return;
    }

    // 2. Clone the SVG to manipulate it without affecting the display
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // 3. Reset the transform on the content group in the clone
    // We want the raw content mapped directly to the viewBox we define below
    const clonedContentGroup = clonedSvg.querySelector('g');
    if (clonedContentGroup) {
        clonedContentGroup.setAttribute('transform', 'translate(0,0) scale(1)');
    }

    // 4. Set the viewBox to fit the ENTIRE content
    clonedSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    
    // 5. Set explicit width/height for the image serialization (control output resolution)
    clonedSvg.setAttribute('width', (width * scale).toString());
    clonedSvg.setAttribute('height', (height * scale).toString());
    
    // 6. Ensure styles are applied (background color)
    // Since SVG has transparent background by default, we'll fill canvas later.
    
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      if (ctx) {
          ctx.fillStyle = "#0f172a"; // Match background (slate-900)
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas);
      } else {
          reject(new Error("Canvas context is null"));
      }
      URL.revokeObjectURL(url);
    };
    
    img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG image for export."));
    }
    
    img.src = url;
  });
};

export const downloadImage = async (svgElement: SVGSVGElement, filename: string) => {
  try {
      const canvas = await svgToCanvas(svgElement);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  } catch (e) {
      console.error("Image export failed", e);
      alert("이미지 저장 중 오류가 발생했습니다: " + (e as Error).message);
  }
};

export const downloadPDF = async (svgElement: SVGSVGElement, filename: string) => {
    try {
        // Use a standard scale for PDF (e.g., 2 for retina-like quality)
        const canvas = await svgToCanvas(svgElement, 2);
        const imgData = canvas.toDataURL("image/png");
        
        // Use original dimensions for PDF page size (px unit)
        const width = canvas.width / 2; 
        const height = canvas.height / 2;

        // Initialize jsPDF with custom page size matching the map content
        const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [width, height] 
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${filename}.pdf`);
    } catch (e) {
        console.error("PDF export failed", e);
        alert("PDF 저장 중 오류가 발생했습니다: " + (e as Error).message);
    }
};