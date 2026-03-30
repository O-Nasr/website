export interface DocNode {
  id: string;
  label: string;
  type: 'folder' | 'document';
  children?: DocNode[];
  path?: string;
  sourceType?: 'html' | 'docx';
}

// Loaded dynamically from the auto-generated manifest
export let documentTree: DocNode[] = [];

export async function loadManifest(): Promise<DocNode[]> {
  const res = await fetch('/doc-manifest.json');
  documentTree = await res.json();
  return documentTree;
}

// Flatten all documents for search
export function getAllDocuments(nodes: DocNode[] = documentTree): DocNode[] {
  const results: DocNode[] = [];
  for (const node of nodes) {
    if (node.type === 'document') {
      results.push(node);
    }
    if (node.children) {
      results.push(...getAllDocuments(node.children));
    }
  }
  return results;
}

// Find document by ID
export function findDocById(id: string, nodes: DocNode[] = documentTree): DocNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findDocById(id, node.children);
      if (found) return found;
    }
  }
  return null;
}
