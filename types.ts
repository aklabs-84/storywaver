import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface StoryNode {
  id: string;
  title: string;
  content: string;
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x for drag
  fy?: number | null; // Fixed y for drag
}

export interface StoryLink {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  label: string; // The choice text
}

// D3 expects objects for links after simulation starts, we need to handle that type intersection
export interface D3Node extends StoryNode, SimulationNodeDatum {}
export interface D3Link extends SimulationLinkDatum<D3Node> {
  id: string;
  label: string;
  source: string | D3Node;
  target: string | D3Node;
}

export interface StoryData {
  nodes: StoryNode[];
  links: StoryLink[];
}
