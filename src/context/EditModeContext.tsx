/**
 * Edit mode context — provides a global toggle for view/edit mode.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

interface EditModeContextType {
  editMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (mode: boolean) => void;
}

const EditModeContext = createContext<EditModeContextType>({
  editMode: false,
  toggleEditMode: () => {},
  setEditMode: () => {},
});

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);

  const toggleEditMode = () => setEditMode((prev) => !prev);

  return (
    <EditModeContext.Provider value={{ editMode, toggleEditMode, setEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEditMode() {
  return useContext(EditModeContext);
}
