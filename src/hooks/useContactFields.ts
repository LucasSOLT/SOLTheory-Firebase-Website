/**
 * @file useContactFields.ts
 * @description Custom hook for managing user-configurable contact field configurations.
 * 
 * Loads and persists field configuration from/to Firestore. Each user has their own
 * field config stored at `users/{uid}/settings/{configKey}`.
 * 
 * Provides methods to:
 * - Toggle field visibility
 * - Reorder visible fields
 * - Create custom fields
 * - Delete custom fields
 * - Bulk update from CSV merge operations
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  type FieldConfig,
  type ContactFieldDef,
  type FieldType,
  createCustomField,
  DEFAULT_CRM_FIELDS,
  DEFAULT_CRM_VISIBLE_FIELDS,
  DEFAULT_CONTACTS_FIELDS,
  DEFAULT_CONTACTS_VISIBLE_FIELDS,
} from "@/lib/contactFieldTypes";

type ConfigMode = "crm" | "contactBook";

interface UseContactFieldsReturn {
  /** Full field config (visible list + all fields) */
  fieldConfig: FieldConfig;
  /** Whether the config is still loading from Firestore */
  isLoading: boolean;
  /** Set a new ordered list of visible field IDs */
  setVisibleFields: (fields: string[]) => void;
  /** Toggle a single field's visibility */
  toggleFieldVisibility: (fieldId: string) => void;
  /** Reorder visible fields (move field from one index to another) */
  reorderField: (fromIndex: number, toIndex: number) => void;
  /** Create a new custom field and optionally make it visible */
  addCustomField: (name: string, type: FieldType, options?: string[], makeVisible?: boolean) => ContactFieldDef;
  /** Delete a custom field (only non-locked fields) */
  deleteCustomField: (fieldId: string) => void;
  /** Add multiple new fields from CSV merge (bulk add) */
  addFieldsFromCSV: (newFields: ContactFieldDef[]) => void;
  /** Save the current config to Firestore (optionally pass a config override to avoid stale state) */
  saveConfig: (overrideConfig?: FieldConfig) => Promise<void>;
  /** Get a field definition by ID */
  getField: (fieldId: string) => ContactFieldDef | undefined;
  /** Get only the visible field definitions in order */
  getVisibleFieldDefs: () => ContactFieldDef[];
  /** Apply a full config update (both visible and all fields at once) */
  applyConfig: (visibleFields: string[], allFields: ContactFieldDef[]) => void;
}

export function useContactFields(mode: ConfigMode = "crm"): UseContactFieldsReturn {
  const firestore = useFirestore();
  const { user } = useUser();

  const defaultFields = mode === "crm" ? DEFAULT_CRM_FIELDS : DEFAULT_CONTACTS_FIELDS;
  const defaultVisible = mode === "crm" ? DEFAULT_CRM_VISIBLE_FIELDS : DEFAULT_CONTACTS_VISIBLE_FIELDS;
  const configKey = mode === "crm" ? "contactFields" : "contactBookFields";

  const [fieldConfig, setFieldConfig] = useState<FieldConfig>({
    visibleFields: defaultVisible,
    allFields: defaultFields,
  });
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const isSavingRef = useRef(false); // Prevent onSnapshot from overwriting local state during save

  // Load config from Firestore with real-time listener (syncs across tabs)
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const docRef = doc(firestore, `users/${user.uid}/settings/${configKey}`);
    
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      // Don't overwrite local state while we're saving
      if (isSavingRef.current) return;

      try {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const savedAllFields: ContactFieldDef[] = data.allFields || defaultFields;
          const savedVisible: string[] = data.visibleFields || defaultVisible;

          // Merge: ensure any NEW system fields added since the user's last save are included
          const savedFieldIds = new Set(savedAllFields.map((f: ContactFieldDef) => f.id));
          const mergedAllFields = [...savedAllFields];
          for (const sysField of defaultFields) {
            if (!savedFieldIds.has(sysField.id)) {
              mergedAllFields.push(sysField);
            }
          }

          setFieldConfig({
            visibleFields: savedVisible,
            allFields: mergedAllFields,
          });
        } else if (!hasLoadedRef.current) {
          // No saved config — use defaults (only on first load)
          setFieldConfig({
            visibleFields: defaultVisible,
            allFields: defaultFields,
          });
        }
        hasLoadedRef.current = true;
      } catch (error) {
        console.error(`[useContactFields] Error loading ${configKey}:`, error);
        if (!hasLoadedRef.current) {
          setFieldConfig({
            visibleFields: defaultVisible,
            allFields: defaultFields,
          });
        }
      } finally {
        setIsLoading(false);
      }
    }, (error) => {
      console.error(`[useContactFields] Snapshot error ${configKey}:`, error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user?.uid, configKey, defaultFields, defaultVisible]);

  // Save config to Firestore
  const saveConfig = useCallback(async (overrideConfig?: FieldConfig) => {
    if (!firestore || !user?.uid) return;
    const configToSave = overrideConfig || fieldConfig;
    isSavingRef.current = true;
    try {
      const docRef = doc(firestore, `users/${user.uid}/settings/${configKey}`);
      await setDoc(docRef, {
        visibleFields: configToSave.visibleFields,
        allFields: configToSave.allFields.map(f => ({
          id: f.id,
          label: f.label,
          type: f.type,
          category: f.category,
          required: f.required || false,
          locked: f.locked || false,
          width: f.width || "w-[130px]",
          icon: f.icon || "Sparkles",
          ...(f.options ? { options: f.options } : {}),
        })),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error(`[useContactFields] Error saving ${configKey}:`, error);
      throw error;
    } finally {
      // Small delay before re-enabling snapshot processing
      // to let Firestore's local cache settle
      setTimeout(() => { isSavingRef.current = false; }, 500);
    }
  }, [firestore, user?.uid, configKey, fieldConfig]);

  const setVisibleFields = useCallback((fields: string[]) => {
    setFieldConfig(prev => ({ ...prev, visibleFields: fields }));
  }, []);

  const toggleFieldVisibility = useCallback((fieldId: string) => {
    setFieldConfig(prev => {
      const field = prev.allFields.find(f => f.id === fieldId);
      if (field?.required) return prev; // Can't toggle required fields

      const isVisible = prev.visibleFields.includes(fieldId);
      const newVisible = isVisible
        ? prev.visibleFields.filter(id => id !== fieldId)
        : [...prev.visibleFields, fieldId];

      return { ...prev, visibleFields: newVisible };
    });
  }, []);

  const reorderField = useCallback((fromIndex: number, toIndex: number) => {
    setFieldConfig(prev => {
      const newVisible = [...prev.visibleFields];
      const [moved] = newVisible.splice(fromIndex, 1);
      newVisible.splice(toIndex, 0, moved);
      return { ...prev, visibleFields: newVisible };
    });
  }, []);

  const addCustomField = useCallback((
    name: string,
    type: FieldType = "text",
    options?: string[],
    makeVisible: boolean = true
  ): ContactFieldDef => {
    const newField = createCustomField(name, type, options);
    setFieldConfig(prev => ({
      visibleFields: makeVisible ? [...prev.visibleFields, newField.id] : prev.visibleFields,
      allFields: [...prev.allFields, newField],
    }));
    return newField;
  }, []);

  const deleteCustomField = useCallback((fieldId: string) => {
    setFieldConfig(prev => {
      const field = prev.allFields.find(f => f.id === fieldId);
      if (!field || field.locked) return prev; // Can't delete locked/system fields
      return {
        visibleFields: prev.visibleFields.filter(id => id !== fieldId),
        allFields: prev.allFields.filter(f => f.id !== fieldId),
      };
    });
  }, []);

  const addFieldsFromCSV = useCallback((newFields: ContactFieldDef[]) => {
    setFieldConfig(prev => {
      const existingIds = new Set(prev.allFields.map(f => f.id));
      const trulyNew = newFields.filter(f => !existingIds.has(f.id));
      if (trulyNew.length === 0) return prev;
      return {
        visibleFields: [...prev.visibleFields, ...trulyNew.map(f => f.id)],
        allFields: [...prev.allFields, ...trulyNew],
      };
    });
  }, []);

  const getField = useCallback((fieldId: string): ContactFieldDef | undefined => {
    return fieldConfig.allFields.find(f => f.id === fieldId);
  }, [fieldConfig.allFields]);

  const getVisibleFieldDefs = useCallback((): ContactFieldDef[] => {
    return fieldConfig.visibleFields
      .map(id => fieldConfig.allFields.find(f => f.id === id))
      .filter((f): f is ContactFieldDef => f !== undefined);
  }, [fieldConfig]);

  const applyConfig = useCallback((visibleFields: string[], allFields: ContactFieldDef[]) => {
    setFieldConfig({ visibleFields, allFields });
  }, []);

  return {
    fieldConfig,
    isLoading,
    setVisibleFields,
    toggleFieldVisibility,
    reorderField,
    addCustomField,
    deleteCustomField,
    addFieldsFromCSV,
    saveConfig,
    getField,
    getVisibleFieldDefs,
    applyConfig,
  };
}
