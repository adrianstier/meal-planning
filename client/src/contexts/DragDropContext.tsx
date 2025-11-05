import React, { createContext, useContext, useState } from 'react';
import type { Meal } from '../types/api';

interface DraggedRecipe {
  meal: Meal;
  sourceType: 'recipes';
}

interface DragDropContextType {
  draggedRecipe: DraggedRecipe | null;
  setDraggedRecipe: (recipe: DraggedRecipe | null) => void;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [draggedRecipe, setDraggedRecipe] = useState<DraggedRecipe | null>(null);

  return (
    <DragDropContext.Provider value={{ draggedRecipe, setDraggedRecipe }}>
      {children}
    </DragDropContext.Provider>
  );
}

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within DragDropProvider');
  }
  return context;
}
