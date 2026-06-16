"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TipTapImage from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import CharacterCount from "@tiptap/extension-character-count";
import {
  ArrowLeft, Undo2, Redo2, Bold, Italic,
  Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks, Quote, Minus,
  Table as TableIcon, Image as ImageIcon, Link as LinkIcon,
  ChevronDown, ChevronUp, Highlighter,
  Subscript as SubIcon, Superscript as SupIcon,
  Code, X, Check, Unlink,
  Heading1, Heading2, Heading3, Heading4, Pilcrow,
  Rows3, Columns3, Trash2, Printer, RemoveFormatting,
  Search, Replace, Keyboard, ZoomIn, ZoomOut,
  FileText, Clock, Indent, Outdent,
  ALargeSmall, ArrowDownUp, Download,
  Clipboard, Copy, Scissors,
} from "lucide-react";
import "./editor-styles.css";

/* ═══════════════════════════════════════════════════════════════
   CUSTOM EXTENSION: FontSize via TextStyle
   ═══════════════════════════════════════════════════════════════ */

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize?.replace(/['"]+/g, "") || null,
          renderHTML: (attrs) => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands(): any {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   CUSTOM EXTENSION: LineHeight
   ═══════════════════════════════════════════════════════════════ */

const LineHeight = Extension.create({
  name: "lineHeight",
  addOptions() { return { types: ["paragraph", "heading"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => el.style.lineHeight || null,
          renderHTML: (attrs) => {
            if (!attrs.lineHeight) return {};
            return { style: `line-height: ${attrs.lineHeight}` };
          },
        },
      },
    }];
  },
  addCommands(): any {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }: any) => {
        return this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight }));
      },
      unsetLineHeight: () => ({ commands }: any) => {
        return this.options.types.every((type: string) => commands.resetAttributes(type, "lineHeight"));
      },
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Georgia", value: "Georgia" },
  { label: "Courier New", value: "Courier New" },
  { label: "Verdana", value: "Verdana" },
  { label: "Garamond", value: "Garamond" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
  { label: "Palatino", value: "Palatino Linotype, Book Antiqua, Palatino" },
  { label: "Lato", value: "Lato" },
  { label: "Open Sans", value: "Open Sans" },
  { label: "Roboto", value: "Roboto" },
  { label: "Merriweather", value: "Merriweather" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Source Code Pro", value: "Source Code Pro, monospace" },
  { label: "Oswald", value: "Oswald" },
  { label: "Nunito", value: "Nunito" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Poppins", value: "Poppins" },
  { label: "Raleway", value: "Raleway" },
  { label: "Ubuntu", value: "Ubuntu" },
  { label: "Roboto Mono", value: "Roboto Mono, monospace" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "Impact", value: "Impact" },
  { label: "Comic Sans MS", value: "Comic Sans MS" },
];

const FONT_SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "64", "72", "96"];

const LINE_HEIGHTS = [
  { label: "Single", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "Double", value: "2" },
  { label: "2.5", value: "2.5" },
  { label: "Triple", value: "3" },
];

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
];

const HIGHLIGHT_COLORS = [
  "#fef08a", "#bef264", "#67e8f9", "#c4b5fd", "#fda4af",
  "#fed7aa", "#a5f3fc", "#d9f99d", "#e9d5ff", "#fecdd3",
];

const AUTO_SAVE_DELAY = 15000;
const LOCALSTORAGE_PREFIX = "soltheory_doc_";

const SHORTCUTS = [
  { keys: "Ctrl+B", desc: "Bold" }, { keys: "Ctrl+I", desc: "Italic" },
  { keys: "Ctrl+U", desc: "Underline" }, { keys: "Ctrl+Shift+X", desc: "Strikethrough" },
  { keys: "Ctrl+Z", desc: "Undo" }, { keys: "Ctrl+Y", desc: "Redo" },
  { keys: "Ctrl+S", desc: "Save" }, { keys: "Ctrl+F", desc: "Find" },
  { keys: "Ctrl+H", desc: "Find & Replace" }, { keys: "Ctrl+P", desc: "Print" },
  { keys: "Ctrl+K", desc: "Insert Link" }, { keys: "Ctrl+\\", desc: "Clear formatting" },
  { keys: "Tab", desc: "Indent list" }, { keys: "Shift+Tab", desc: "Outdent list" },
];

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

interface DocumentEditorProps {
  fileId: string;
  fileName: string;
  initialContent: string;
  isDark: boolean;
  onSave: (content: string) => void;
  onClose: () => void;
  onRename: (newName: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   TOOLBAR BUTTON — uses onMouseDown to prevent editor blur
   ═══════════════════════════════════════════════════════════════ */

function ToolBtn({ active, disabled, onClick, title, children, isDark }: {
  active?: boolean; disabled?: boolean; onClick: (e: React.MouseEvent) => void;
  title: string; children: React.ReactNode; isDark: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(e); }}
      disabled={disabled}
      title={title}
      className={`w-[28px] h-[28px] rounded-md flex items-center justify-center transition-colors duration-75 cursor-pointer shrink-0 select-none ${
        disabled
          ? "opacity-30 cursor-not-allowed"
          : active
          ? isDark ? "bg-blue-500/25 text-blue-400 ring-1 ring-blue-500/50" : "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
          : isDark ? "text-slate-400 hover:bg-slate-700 hover:text-slate-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function ToolSep({ isDark }: { isDark: boolean }) {
  return <div className={`w-px h-5 mx-0.5 shrink-0 ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />;
}

/* ═══════════════════════════════════════════════════════════════
   TABLE SIZE PICKER
   ═══════════════════════════════════════════════════════════════ */

function TableSizePicker({ isDark, onSelect, onClose }: {
  isDark: boolean; onSelect: (rows: number, cols: number) => void; onClose: () => void;
}) {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  return (
    <div className="p-3" onClick={(e) => e.stopPropagation()}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        {hoverRow > 0 ? `${hoverRow} × ${hoverCol}` : "Select size"}
      </p>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(8, 1fr)` }}>
        {Array.from({ length: 64 }).map((_, i) => {
          const r = Math.floor(i / 8) + 1, c = (i % 8) + 1;
          const hl = r <= hoverRow && c <= hoverCol;
          return (
            <div key={i} onMouseEnter={() => { setHoverRow(r); setHoverCol(c); }}
              onClick={() => { onSelect(r, c); onClose(); }}
              className={`w-4 h-4 rounded-[2px] border cursor-pointer transition-colors ${hl ? "bg-blue-500 border-blue-400" : isDark ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FIND & REPLACE — uses editor selection, no DOM manipulation
   ═══════════════════════════════════════════════════════════════ */

function FindReplacePanel({ isDark, editor, mode, onClose }: {
  isDark: boolean; editor: any; mode: "find" | "replace"; onClose: () => void;
}) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const [showReplace, setShowReplace] = useState(mode === "replace");

  useEffect(() => { findRef.current?.focus(); }, []);

  // Find all match positions in the ProseMirror doc
  const matches = useMemo(() => {
    if (!editor || !findText) return [];
    const results: { from: number; to: number }[] = [];
    const searchLower = findText.toLowerCase();
    editor.state.doc.descendants((node: any, pos: number) => {
      if (!node.isText) return;
      const text = node.text || "";
      let idx = 0;
      while (true) {
        const found = text.toLowerCase().indexOf(searchLower, idx);
        if (found === -1) break;
        results.push({ from: pos + found, to: pos + found + findText.length });
        idx = found + 1;
      }
    });
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findText, editor?.state?.doc]);

  // Navigate to match using editor selection (safe approach)
  const goToMatch = useCallback((idx: number) => {
    if (!editor || matches.length === 0) return;
    const wrapped = ((idx % matches.length) + matches.length) % matches.length;
    setCurrentIdx(wrapped);
    const match = matches[wrapped];
    // Set editor selection to highlight the match
    editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run();
    // Scroll into view via the editor's built-in scrollIntoView
    editor.commands.scrollIntoView();
  }, [editor, matches]);

  const handleFindNext = () => goToMatch(currentIdx + 1);
  const handleFindPrev = () => goToMatch(currentIdx - 1);

  const handleReplace = () => {
    if (!editor || !findText || matches.length === 0) return;
    const match = matches[currentIdx];
    if (match) {
      editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).insertContent(replaceText).run();
    }
  };

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    editor.commands.setContent(html.replace(regex, replaceText));
  };

  // Auto-navigate to first match on search change
  useEffect(() => {
    if (matches.length > 0) goToMatch(0);
    else setCurrentIdx(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length, findText]);

  const bg = isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200";
  const inputCls = isDark ? "bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-400";
  const textS = isDark ? "text-slate-400" : "text-slate-500";
  const btnCls = isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500";

  return (
    <div className={`absolute top-0 right-4 z-50 rounded-b-xl border border-t-0 shadow-lg ${bg} p-3 w-[380px]`}>
      <div className="flex items-center gap-2 mb-2">
        <Search className={`w-3.5 h-3.5 shrink-0 ${textS}`} />
        <input ref={findRef} type="text" value={findText}
          onChange={(e) => setFindText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.shiftKey ? handleFindPrev() : handleFindNext(); } if (e.key === "Escape") onClose(); }}
          placeholder="Find in document..."
          className={`flex-1 px-2.5 py-1.5 rounded-lg text-[12px] border outline-none focus:ring-2 focus:ring-blue-200 ${inputCls}`}
        />
        <span className={`text-[10px] font-semibold tabular-nums shrink-0 min-w-[36px] text-center ${textS}`}>
          {matches.length > 0 ? `${currentIdx + 1}/${matches.length}` : findText ? "0" : ""}
        </span>
        <button onClick={handleFindPrev} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${btnCls}`} title="Previous"><ChevronUp className="w-3 h-3" /></button>
        <button onClick={handleFindNext} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${btnCls}`} title="Next"><ChevronDown className="w-3 h-3" /></button>
        {!showReplace && <button onClick={() => setShowReplace(true)} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${btnCls}`} title="Show replace"><Replace className="w-3 h-3" /></button>}
        <button onClick={onClose} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${btnCls}`}><X className="w-3 h-3" /></button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-2">
          <Replace className={`w-3.5 h-3.5 shrink-0 ${textS}`} />
          <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleReplace(); if (e.key === "Escape") onClose(); }}
            placeholder="Replace with..."
            className={`flex-1 px-2.5 py-1.5 rounded-lg text-[12px] border outline-none focus:ring-2 focus:ring-blue-200 ${inputCls}`}
          />
          <button onClick={handleReplace} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer border ${isDark ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>Replace</button>
          <button onClick={handleReplaceAll} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer border ${isDark ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>All</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHORTCUTS PANEL
   ═══════════════════════════════════════════════════════════════ */

function ShortcutsPanel({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const bg = isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200";
  const textP = isDark ? "text-slate-200" : "text-slate-800";
  const kbdCls = isDark ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600";
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[600] backdrop-blur-sm" onClick={onClose} />
      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[610] w-[420px] max-h-[70vh] rounded-2xl border shadow-2xl ${bg} overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          <div className="flex items-center gap-2">
            <Keyboard className={`w-4 h-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
            <h3 className={`text-[15px] font-bold ${textP}`}>Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[55vh] px-5 py-3">
          {SHORTCUTS.map((s) => (
            <div key={s.keys + s.desc} className={`flex items-center justify-between py-2 border-b last:border-b-0 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <span className={`text-[13px] ${textP}`}>{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.split("+").map((k) => (
                  <kbd key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${kbdCls}`}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function DocumentEditor({
  fileId, fileName, initialContent, isDark, onSave, onClose, onRename,
}: DocumentEditorProps) {
  // ─── State ───
  const [docTitle, setDocTitle] = useState(fileName.replace(/\.[^.]+$/, ""));
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceRender] = useState(0);

  // Dropdowns
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showLineHeight, setShowLineHeight] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [fontSizeInput, setFontSizeInput] = useState("");

  // Feature panels
  const [showFindReplace, setShowFindReplace] = useState<"find" | "replace" | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number } | null>(null);

  // ─── Collapse sidebar on mount, restore on unmount ───
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("soltheory-sidebar-toggle", { detail: { action: "collapse" } }));
    return () => {
      window.dispatchEvent(new CustomEvent("soltheory-sidebar-toggle", { detail: { action: "restore" } }));
    };
  }, []);

  // Close all dropdowns
  const closeAllDropdowns = useCallback(() => {
    setShowFontFamily(false); setShowFontSize(false); setShowTextColor(false);
    setShowHighlight(false); setShowLinkInput(false); setShowImageInput(false);
    setShowHeadingMenu(false); setShowTableMenu(false); setShowLineHeight(false);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-dropdown]")) closeAllDropdowns();
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [closeAllDropdowns]);

  // ─── Load from localStorage ───
  const getStoredContent = useCallback(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_PREFIX + fileId);
      if (stored) { const p = JSON.parse(stored); if (p.content) return p.content; }
    } catch { /* ignore */ }
    return null;
  }, [fileId]);

  const contentToLoad = getStoredContent() || initialContent || "<p></p>";

  // ─── Editor ───
  const editorExtensions = useMemo(() => {
    try {
      return [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        Underline,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder: "Start typing your document..." }),
        TextStyle,
        FontSize,
        LineHeight,
        Color,
        Highlight.configure({ multicolor: true }),
        Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
        TipTapImage.configure({ inline: false, allowBase64: true }),
        Table.configure({ resizable: false }),
        TableRow, TableCell, TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        FontFamily, Subscript, Superscript, CharacterCount,
      ];
    } catch (err) {
      console.error("[DocumentEditor] Failed to initialize extensions:", err);
      return [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        Underline,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder: "Start typing your document..." }),
      ];
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: contentToLoad,
    editorProps: {
      attributes: { class: isDark ? "dark-editor" : "" },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0 && files[0].type.startsWith("image/")) {
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = (re) => {
            const src = re.target?.result as string;
            if (src) {
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              const pos = coords?.pos ?? view.state.selection.to;
              const node = view.state.schema.nodes.image.create({ src });
              view.dispatch(view.state.tr.insert(pos, node));
            }
          };
          reader.readAsDataURL(files[0]);
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
              event.preventDefault();
              const file = items[i].getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                  const src = re.target?.result as string;
                  if (src) {
                    const node = view.state.schema.nodes.image.create({ src });
                    view.dispatch(view.state.tr.replaceSelectionWith(node));
                  }
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: () => setSaveStatus("unsaved"),
    onTransaction: () => forceRender((n) => n + 1),
  });

  // Dark mode sync
  useEffect(() => {
    if (editor) editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: { class: isDark ? "dark-editor" : "" } } });
  }, [isDark, editor]);

  // ─── Auto-save ───
  useEffect(() => {
    if (!editor || saveStatus !== "unsaved") return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const html = editor.getHTML();
      try { localStorage.setItem(LOCALSTORAGE_PREFIX + fileId, JSON.stringify({ content: html, timestamp: Date.now() })); } catch {}
      setSaveStatus("saving"); onSave(html); setLastSaved(new Date());
      setTimeout(() => setSaveStatus("saved"), 400);
    }, AUTO_SAVE_DELAY);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [editor, saveStatus, fileId, onSave]);

  // ─── Manual save ───
  const doSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    setSaveStatus("saving"); onSave(html);
    try { localStorage.setItem(LOCALSTORAGE_PREFIX + fileId, JSON.stringify({ content: html, timestamp: Date.now() })); } catch {}
    setLastSaved(new Date());
    setTimeout(() => setSaveStatus("saved"), 400);
  }, [editor, onSave, fileId]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "s") { e.preventDefault(); doSave(); }
      else if (ctrl && e.key === "f" && !e.shiftKey) { e.preventDefault(); setShowFindReplace("find"); }
      else if (ctrl && e.key === "h") { e.preventDefault(); setShowFindReplace("replace"); }
      else if (ctrl && e.key === "p") { e.preventDefault(); handlePrint(); }
      else if (ctrl && e.key === "k") {
        e.preventDefault(); closeAllDropdowns(); setShowLinkInput(true);
        if (editor) { const prev = editor.getAttributes("link")?.href; if (prev) setLinkUrl(prev); }
      }
      else if (ctrl && e.key === "\\") { e.preventDefault(); if (editor) editor.chain().focus().clearNodes().unsetAllMarks().run(); }
      else if (e.key === "Escape") setShowFindReplace(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, doSave, closeAllDropdowns, handlePrint]);

  // ─── Title editing ───
  useEffect(() => { if (isEditingTitle && titleInputRef.current) { titleInputRef.current.focus(); titleInputRef.current.select(); } }, [isEditingTitle]);

  const handleTitleSave = () => {
    const trimmed = docTitle.trim();
    if (trimmed) { const ext = fileName.includes(".") ? fileName.split(".").pop() : "txt"; onRename(`${trimmed}.${ext}`); }
    setIsEditingTitle(false);
  };

  // ─── Save & Close ───
  const handleSaveAndClose = useCallback(() => {
    if (editor && saveStatus === "unsaved") {
      const html = editor.getHTML();
      onSave(html);
      try { localStorage.setItem(LOCALSTORAGE_PREFIX + fileId, JSON.stringify({ content: html, timestamp: Date.now() })); } catch {}
    }
    onClose();
  }, [editor, saveStatus, onSave, onClose, fileId]);

  // ─── Print ───
  const handlePrint = useCallback(() => {
    if (!editor) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${docTitle}</title>
      <style>body{font-family:'Inter',-apple-system,sans-serif;font-size:15px;line-height:1.75;color:#1e293b;max-width:816px;margin:40px auto;padding:0 40px}
      h1{font-size:2em;font-weight:700;margin-top:1.2em}h2{font-size:1.5em;font-weight:700;margin-top:1em}h3{font-size:1.25em;font-weight:600}
      blockquote{border-left:3px solid #c7d2fe;padding-left:1em;color:#475569;font-style:italic}
      code{background:#f1f5f9;border-radius:4px;padding:2px 6px;font-family:monospace}pre{background:#0f172a;border-radius:8px;padding:16px;color:#e2e8f0}pre code{background:none;color:inherit}
      table{border-collapse:collapse;width:100%;margin:1em 0}th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}th{background:#f8fafc;font-weight:600}
      img{max-width:100%;height:auto}a{color:#4f46e5;text-decoration:underline}
      @media print{body{margin:0;padding:20px}}</style>
      </head><body>${editor.getHTML()}</body></html>`);
    w.document.close(); w.print();
  }, [editor, docTitle]);

  // ─── Link & Image ───
  const handleSetLink = () => {
    if (!editor || !linkUrl.trim()) return;
    const url = linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkUrl(""); setShowLinkInput(false);
  };

  const handleInsertImage = () => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl(""); setShowImageInput(false);
  };

  // ─── Font size helpers ───
  const getCurrentFontSize = () => {
    if (!editor) return "15";
    const fs = editor.getAttributes("textStyle")?.fontSize;
    if (fs) return fs.replace("px", "").replace("pt", "");
    return "15";
  };

  const applyFontSize = (size: string) => {
    if (!editor) return;
    const n = parseInt(size);
    if (isNaN(n) || n < 1 || n > 400) return;
    (editor.commands as any).setFontSize(`${n}px`);
    setFontSizeInput("");
    setShowFontSize(false);
  };

  // ─── Derived ───
  const currentFontFamily = editor?.getAttributes("textStyle")?.fontFamily || "Inter";
  const currentFontLabel = FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label || currentFontFamily;
  const getHeadingLabel = () => {
    if (!editor) return "Normal";
    for (let i = 1; i <= 4; i++) { if (editor.isActive("heading", { level: i })) return `Heading ${i}`; }
    return "Normal";
  };
  const getLastSavedText = () => {
    if (!lastSaved) return "";
    const diff = Date.now() - lastSaved.getTime();
    if (diff < 60000) return "Saved just now";
    return `Saved ${Math.floor(diff / 60000)}m ago`;
  };

  // Theme tokens
  const toolbarBg = isDark ? "bg-slate-900" : "bg-white";
  const toolbarBorder = isDark ? "border-slate-700" : "border-slate-200";
  const dropBg = isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200";
  const dropHover = isDark ? "hover:bg-slate-700" : "hover:bg-slate-50";
  const textP = isDark ? "text-slate-200" : "text-slate-800";
  const textS = isDark ? "text-slate-400" : "text-slate-500";
  const textM = isDark ? "text-slate-500" : "text-slate-400";
  const inputCls = isDark ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700";

  if (!editor) return null;

  const chars = editor.storage.characterCount.characters();
  const words = editor.storage.characterCount.words();
  const readingTime = Math.max(1, Math.ceil(words / 200));
  const paragraphs = editor.state.doc.content.childCount;

  return (
    <div className={`fixed inset-0 z-[500] flex flex-col ${isDark ? "bg-slate-950" : "bg-[#f0ede6]"}`}>

      {/* ═══ TOP BAR ═══ */}
      <div className={`h-11 flex items-center justify-between px-3 border-b ${toolbarBg} ${toolbarBorder} shrink-0 z-10`}>
        <div className="flex items-center gap-2.5">
          <button onClick={handleSaveAndClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
            title="Back to Media Library">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-blue-500/20" : "bg-blue-50"}`}>
            <FileText className={`w-3.5 h-3.5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
          </div>
          {isEditingTitle ? (
            <input ref={titleInputRef} value={docTitle} onChange={(e) => setDocTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") { setDocTitle(fileName.replace(/\.[^.]+$/, "")); setIsEditingTitle(false); } }}
              className={`px-2 py-1 text-[13px] font-semibold rounded-lg border outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-64 ${inputCls}`}
            />
          ) : (
            <button onClick={() => setIsEditingTitle(true)}
              className={`text-[13px] font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer ${textP} ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
              title="Click to rename">{docTitle}</button>
          )}
          <div className="flex items-center gap-1.5 ml-1">
            <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === "saved" ? "bg-emerald-500" : saveStatus === "saving" ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
            <span className={`text-[10px] font-medium ${saveStatus === "saved" ? "text-emerald-500" : saveStatus === "saving" ? "text-amber-500" : textM}`}>
              {saveStatus === "saved" ? (getLastSavedText() || "Saved") : saveStatus === "saving" ? "Saving..." : "Unsaved"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 mr-1">
            <button onClick={() => setZoom((z) => Math.max(50, z - 10))} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"}`}><ZoomOut className="w-3 h-3" /></button>
            <button onClick={() => setZoom(100)} className={`px-1 text-[10px] font-semibold tabular-nums cursor-pointer rounded min-w-[32px] text-center ${isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>{zoom}%</button>
            <button onClick={() => setZoom((z) => Math.min(200, z + 10))} className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"}`}><ZoomIn className="w-3 h-3" /></button>
          </div>
          <button onClick={() => setShowFindReplace("find")} className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`} title="Find (Ctrl+F)"><Search className="w-3.5 h-3.5" /></button>
          <button onClick={handlePrint} className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`} title="Print (Ctrl+P)"><Printer className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowShortcuts(true)} className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`} title="Shortcuts"><Keyboard className="w-3.5 h-3.5" /></button>
          <button onClick={doSave} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer ml-1">Save</button>
        </div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className={`relative flex items-center gap-0.5 px-3 py-1 border-b ${toolbarBg} ${toolbarBorder} shrink-0 flex-wrap min-h-[36px]`}>
        {/* Undo / Redo */}
        <ToolBtn isDark={isDark} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Heading selector */}
        <div className="relative" data-dropdown>
          <button onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowHeadingMenu(!showHeadingMenu); }}
            className={`h-[28px] px-2 rounded-md flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}>
            {getHeadingLabel()} <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {showHeadingMenu && (
            <div className={`absolute top-full left-0 mt-1 rounded-xl border shadow-xl py-1 min-w-[170px] z-50 ${dropBg}`}>
              {[
                { label: "Normal text", action: () => editor.chain().focus().setParagraph().run(), active: !editor.isActive("heading"), icon: <Pilcrow className="w-3.5 h-3.5" />, style: "text-[13px]" },
                { label: "Heading 1", action: () => editor.chain().focus().toggleHeading({ level: 1 as const }).run(), active: editor.isActive("heading", { level: 1 }), icon: <Heading1 className="w-4 h-4" />, style: "text-[18px] font-bold" },
                { label: "Heading 2", action: () => editor.chain().focus().toggleHeading({ level: 2 as const }).run(), active: editor.isActive("heading", { level: 2 }), icon: <Heading2 className="w-4 h-4" />, style: "text-[16px] font-bold" },
                { label: "Heading 3", action: () => editor.chain().focus().toggleHeading({ level: 3 as const }).run(), active: editor.isActive("heading", { level: 3 }), icon: <Heading3 className="w-3.5 h-3.5" />, style: "text-[14px] font-semibold" },
                { label: "Heading 4", action: () => editor.chain().focus().toggleHeading({ level: 4 as const }).run(), active: editor.isActive("heading", { level: 4 }), icon: <Heading4 className="w-3.5 h-3.5" />, style: "text-[13px] font-semibold" },
              ].map((item) => (
                <button key={item.label} onMouseDown={(e) => { e.preventDefault(); item.action(); setShowHeadingMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors cursor-pointer ${item.active ? (isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-700") : `${textP} ${dropHover}`} ${item.style}`}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolSep isDark={isDark} />

        {/* Font Family */}
        <div className="relative" data-dropdown>
          <button onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowFontFamily(!showFontFamily); }}
            className={`h-[28px] px-2 rounded-md flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer max-w-[115px] truncate ${isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}
            title={`Font: ${currentFontLabel}`}>
            <span className="truncate">{currentFontLabel}</span>
            <ChevronDown className="w-2.5 h-2.5 shrink-0" />
          </button>
          {showFontFamily && (
            <div className={`absolute top-full left-0 mt-1 rounded-xl border shadow-xl py-1 min-w-[190px] max-h-[300px] overflow-y-auto z-50 ${dropBg}`}>
              {FONT_FAMILIES.map((font) => (
                <button key={font.value}
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setFontFamily(font.value).run(); setShowFontFamily(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors cursor-pointer ${dropHover} ${textP} ${currentFontFamily === font.value ? (isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700") : ""}`}
                  style={{ fontFamily: font.value }}>
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size — input + dropdown like Google Docs */}
        <div className="relative flex items-center" data-dropdown>
          <button onMouseDown={(e) => { e.preventDefault(); if (editor) { const cur = parseInt(getCurrentFontSize()); applyFontSize(String(Math.max(1, cur - 1))); } }}
            className={`w-5 h-[28px] rounded-l-md flex items-center justify-center cursor-pointer border-y border-l ${isDark ? "border-slate-600 text-slate-400 hover:bg-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`} title="Decrease font size">
            <Minus className="w-2.5 h-2.5" />
          </button>
          <input
            type="text"
            value={fontSizeInput || getCurrentFontSize()}
            onChange={(e) => setFontSizeInput(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={() => setFontSizeInput(getCurrentFontSize())}
            onBlur={() => { if (fontSizeInput) applyFontSize(fontSizeInput); setFontSizeInput(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { if (fontSizeInput) applyFontSize(fontSizeInput); (e.target as HTMLInputElement).blur(); } }}
            className={`w-[32px] h-[28px] text-center text-[11px] font-semibold border-y outline-none ${isDark ? "bg-slate-800 border-slate-600 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}
          />
          <button onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowFontSize(!showFontSize); }}
            className={`w-4 h-[28px] rounded-r-md flex items-center justify-center cursor-pointer border-y border-r ${isDark ? "border-slate-600 text-slate-400 hover:bg-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
            <ChevronDown className="w-2 h-2" />
          </button>
          {showFontSize && (
            <div className={`absolute top-full left-0 mt-1 rounded-xl border shadow-xl py-1 min-w-[70px] max-h-[240px] overflow-y-auto z-50 ${dropBg}`}>
              {FONT_SIZES.map((s) => (
                <button key={s} onMouseDown={(e) => { e.preventDefault(); applyFontSize(s); }}
                  className={`w-full text-center px-3 py-1 text-[12px] font-medium cursor-pointer ${dropHover} ${textP} ${getCurrentFontSize() === s ? (isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700") : ""}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolSep isDark={isDark} />

        {/* Bold, Italic, Underline, Strikethrough */}
        <ToolBtn isDark={isDark} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)"><UnderlineIcon className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Text Color */}
        <div className="relative" data-dropdown>
          <ToolBtn isDark={isDark} onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowTextColor(!showTextColor); }} title="Text color">
            <div className="flex flex-col items-center gap-0">
              <ALargeSmall className="w-3.5 h-3.5" />
              <div className="w-3.5 h-[3px] rounded-full" style={{ backgroundColor: editor.getAttributes("textStyle")?.color || (isDark ? "#e2e8f0" : "#1e293b") }} />
            </div>
          </ToolBtn>
          {showTextColor && (
            <div className={`absolute top-full mt-1 rounded-xl border shadow-xl p-3 z-50 ${dropBg}`} style={{ left: "50%", transform: "translateX(-50%)", width: "264px" }} onClick={(e) => e.stopPropagation()}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textS}`}>Text Color</p>
              <div className="grid grid-cols-10 gap-[5px]">
                {TEXT_COLORS.map((color) => (
                  <button key={color} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(color).run(); setShowTextColor(false); }}
                    className="w-[20px] h-[20px] rounded-sm cursor-pointer hover:scale-125 transition-transform ring-1 ring-black/10"
                    style={{ backgroundColor: color }} title={color} />
                ))}
              </div>
              <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowTextColor(false); }}
                className={`mt-2.5 text-[11px] font-medium ${textS} hover:underline cursor-pointer`}>Reset color</button>
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative" data-dropdown>
          <ToolBtn isDark={isDark} active={editor.isActive("highlight")} onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowHighlight(!showHighlight); }} title="Highlight"><Highlighter className="w-3.5 h-3.5" /></ToolBtn>
          {showHighlight && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-xl border shadow-xl p-3 z-50 ${dropBg}`} onClick={(e) => e.stopPropagation()}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textS}`}>Highlight</p>
              <div className="flex gap-1.5 flex-wrap">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button key={color} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color }).run(); setShowHighlight(false); }}
                    className="w-6 h-6 rounded-md cursor-pointer hover:scale-110 transition-transform ring-1 ring-black/10" style={{ backgroundColor: color }} />
                ))}
              </div>
              <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setShowHighlight(false); }}
                className={`mt-2 text-[11px] font-medium ${textS} hover:underline cursor-pointer`}>Remove</button>
            </div>
          )}
        </div>
        <ToolSep isDark={isDark} />

        {/* Link */}
        <div className="relative" data-dropdown>
          <ToolBtn isDark={isDark} active={editor.isActive("link")} onClick={(e) => {
            e.stopPropagation(); closeAllDropdowns();
            if (editor.isActive("link")) editor.chain().focus().unsetLink().run();
            else { setShowLinkInput(true); const prev = editor.getAttributes("link")?.href; if (prev) setLinkUrl(prev); }
          }} title="Link (Ctrl+K)"><LinkIcon className="w-3.5 h-3.5" /></ToolBtn>
          {showLinkInput && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-xl border shadow-xl p-3 z-50 w-72 ${dropBg}`} onClick={(e) => e.stopPropagation()}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textS}`}>Link</p>
              <div className="flex items-center gap-2">
                <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSetLink(); if (e.key === "Escape") setShowLinkInput(false); }}
                  placeholder="https://..." className={`flex-1 px-2.5 py-1.5 rounded-lg text-[12px] border outline-none focus:ring-2 focus:ring-blue-200 ${inputCls}`} autoFocus />
                <button onMouseDown={(e) => { e.preventDefault(); handleSetLink(); }} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-blue-700"><Check className="w-3 h-3" /></button>
                {editor.isActive("link") && (
                  <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run(); setShowLinkInput(false); setLinkUrl(""); }}
                    className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center cursor-pointer hover:bg-red-600"><Unlink className="w-3 h-3" /></button>
                )}
              </div>
            </div>
          )}
        </div>

        <ToolBtn isDark={isDark} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting (Ctrl+\\)"><RemoveFormatting className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Alignment */}
        <ToolBtn isDark={isDark} active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left"><AlignLeft className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center"><AlignCenter className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right"><AlignRight className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify"><AlignJustify className="w-3.5 h-3.5" /></ToolBtn>

        {/* Line spacing */}
        <div className="relative" data-dropdown>
          <ToolBtn isDark={isDark} onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowLineHeight(!showLineHeight); }} title="Line & paragraph spacing"><ArrowDownUp className="w-3.5 h-3.5" /></ToolBtn>
          {showLineHeight && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-xl border shadow-xl py-1 min-w-[140px] z-50 ${dropBg}`} onClick={(e) => e.stopPropagation()}>
              <p className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${textS}`}>Line spacing</p>
              {LINE_HEIGHTS.map((lh) => (
                <button key={lh.value} onMouseDown={(e) => { e.preventDefault(); (editor.commands as any).setLineHeight(lh.value); setShowLineHeight(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] font-medium cursor-pointer ${dropHover} ${textP}`}>
                  {lh.label}
                </button>
              ))}
              <div className={`my-1 mx-2 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
              <button onMouseDown={(e) => { e.preventDefault(); (editor.commands as any).unsetLineHeight(); setShowLineHeight(false); }}
                className={`w-full text-left px-3 py-1.5 text-[12px] font-medium cursor-pointer ${dropHover} ${textS}`}>
                Reset
              </button>
            </div>
          )}
        </div>
        <ToolSep isDark={isDark} />

        {/* Indent / Outdent */}
        <ToolBtn isDark={isDark} onClick={() => editor.chain().focus().sinkListItem("listItem").run()} disabled={!editor.can().sinkListItem("listItem")} title="Indent (Tab)"><Indent className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} onClick={() => editor.chain().focus().liftListItem("listItem").run()} disabled={!editor.can().liftListItem("listItem")} title="Outdent (Shift+Tab)"><Outdent className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Lists */}
        <ToolBtn isDark={isDark} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list"><ListChecks className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Block formatting */}
        <ToolBtn isDark={isDark} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Block quote"><Quote className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule"><Minus className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block"><Code className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Subscript / Superscript */}
        <ToolBtn isDark={isDark} active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript"><SubIcon className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn isDark={isDark} active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript"><SupIcon className="w-3.5 h-3.5" /></ToolBtn>
        <ToolSep isDark={isDark} />

        {/* Table */}
        <div className="relative" data-dropdown>
          <ToolBtn isDark={isDark} onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowTableMenu(!showTableMenu); }} title="Table"><TableIcon className="w-3.5 h-3.5" /></ToolBtn>
          {showTableMenu && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-xl border shadow-xl z-50 min-w-[190px] ${dropBg}`} onClick={(e) => e.stopPropagation()}>
              {!editor.isActive("table") ? (
                <TableSizePicker isDark={isDark} onSelect={(r, c) => editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()} onClose={() => setShowTableMenu(false)} />
              ) : (
                <div className="py-1">
                  {[
                    { label: "Row after", icon: Rows3, action: () => editor.chain().focus().addRowAfter().run() },
                    { label: "Row before", icon: Rows3, action: () => editor.chain().focus().addRowBefore().run() },
                    { label: "Column after", icon: Columns3, action: () => editor.chain().focus().addColumnAfter().run() },
                    { label: "Column before", icon: Columns3, action: () => editor.chain().focus().addColumnBefore().run() },
                  ].map(({ label, icon: Icon, action }) => (
                    <button key={label} onMouseDown={(e) => { e.preventDefault(); action(); setShowTableMenu(false); }} className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium cursor-pointer ${textP} ${dropHover}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                  <div className={`my-1 mx-2 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
                  {[
                    { label: "Delete row", action: () => editor.chain().focus().deleteRow().run() },
                    { label: "Delete column", action: () => editor.chain().focus().deleteColumn().run() },
                    { label: "Delete table", action: () => editor.chain().focus().deleteTable().run() },
                  ].map(({ label, action }) => (
                    <button key={label} onMouseDown={(e) => { e.preventDefault(); action(); setShowTableMenu(false); }} className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium cursor-pointer text-red-500 ${dropHover}`}>
                      <Trash2 className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image */}
        <div className="relative" data-dropdown>
          <ToolBtn isDark={isDark} onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowImageInput(!showImageInput); }} title="Insert image"><ImageIcon className="w-3.5 h-3.5" /></ToolBtn>
          {showImageInput && (
            <div className={`absolute top-full right-0 mt-1 rounded-xl border shadow-xl p-3 z-50 w-72 ${dropBg}`} onClick={(e) => e.stopPropagation()}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${textS}`}>Image</p>
              <p className={`text-[10px] mb-2 ${textM}`}>URL or drag & drop onto editor</p>
              <div className="flex items-center gap-2">
                <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleInsertImage(); if (e.key === "Escape") setShowImageInput(false); }}
                  placeholder="https://example.com/image.png" className={`flex-1 px-2.5 py-1.5 rounded-lg text-[12px] border outline-none focus:ring-2 focus:ring-blue-200 ${inputCls}`} autoFocus />
                <button onMouseDown={(e) => { e.preventDefault(); handleInsertImage(); }} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-blue-700"><Check className="w-3 h-3" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Find panel overlays the toolbar */}
        {showFindReplace && <FindReplacePanel isDark={isDark} editor={editor} mode={showFindReplace} onClose={() => setShowFindReplace(null)} />}
      </div>

      {/* ═══ EDITOR CANVAS ═══ */}
      <div className={`flex-1 overflow-y-auto editor-canvas-scroll ${isDark ? "bg-slate-950" : "bg-[#f0ede6]"}`}
        onContextMenu={(e) => {
          // Custom right-click context menu
          e.preventDefault();
          setEditorContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex justify-center py-8 px-4" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
          <div className={`tiptap-editor w-full max-w-[816px] editor-paginated ${isDark ? "dark-mode" : ""}`}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ═══ EDITOR RIGHT-CLICK CONTEXT MENU ═══ */}
      {editorContextMenu && (
        <>
          <div className="fixed inset-0 z-[550]" onClick={() => setEditorContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setEditorContextMenu(null); }} />
          <div
            className={`fixed z-[560] border rounded-xl shadow-2xl py-1.5 min-w-[200px] ${dropBg}`}
            style={{ top: Math.min(editorContextMenu.y, window.innerHeight - 320), left: Math.min(editorContextMenu.x, window.innerWidth - 220) }}
          >
            {[
              { label: "Cut", icon: Scissors, shortcut: "Ctrl+X", action: () => { document.execCommand("cut"); } },
              { label: "Copy", icon: Copy, shortcut: "Ctrl+C", action: () => { document.execCommand("copy"); } },
              { label: "Paste", icon: Clipboard, shortcut: "Ctrl+V", action: () => { navigator.clipboard.readText().then(t => { if (t) editor.chain().focus().insertContent(t).run(); }); } },
            ].map(({ label, icon: Icon, shortcut, action }) => (
              <button key={label}
                onClick={() => { action(); setEditorContextMenu(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium transition-colors cursor-pointer ${textP} ${dropHover}`}>
                <div className="flex items-center gap-2.5"><Icon className={`w-3.5 h-3.5 ${textS}`} />{label}</div>
                <span className={`text-[10px] ${textM}`}>{shortcut}</span>
              </button>
            ))}
            <div className={`my-1 mx-2.5 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
            {[
              { label: "Bold", active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
              { label: "Italic", active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
              { label: "Underline", active: editor.isActive("underline"), action: () => editor.chain().focus().toggleUnderline().run() },
              { label: "Strikethrough", active: editor.isActive("strike"), action: () => editor.chain().focus().toggleStrike().run() },
            ].map(({ label, active, action }) => (
              <button key={label}
                onClick={() => { action(); setEditorContextMenu(null); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${active ? (isDark ? "text-blue-400" : "text-blue-700") : textP} ${dropHover}`}>
                <span>{label}</span>
                {active && <Check className="w-3 h-3" />}
              </button>
            ))}
            <div className={`my-1 mx-2.5 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
            {[
              { label: "Insert link...", action: () => { closeAllDropdowns(); setShowLinkInput(true); } },
              { label: "Clear formatting", action: () => editor.chain().focus().clearNodes().unsetAllMarks().run() },
              { label: "Find...", action: () => setShowFindReplace("find") },
            ].map(({ label, action }) => (
              <button key={label}
                onClick={() => { action(); setEditorContextMenu(null); }}
                className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${textP} ${dropHover}`}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ═══ STATUS BAR ═══ */}
      <div className={`h-7 flex items-center justify-between px-4 border-t ${toolbarBg} ${toolbarBorder} shrink-0`}>
        <div className={`flex items-center gap-4 text-[10px] font-medium ${textM}`}>
          <span>{words} words</span>
          <span>{chars} chars</span>
          <span>{paragraphs} ¶</span>
          <span>~{Math.max(1, Math.ceil(chars / 1800))} {Math.max(1, Math.ceil(chars / 1800)) === 1 ? "page" : "pages"}</span>
          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{readingTime} min</span>
        </div>
        <div className={`flex items-center gap-2 text-[10px] font-medium ${textM}`}>
          <button onClick={() => {
            const html = editor.getHTML();
            const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>body{font-family:Inter,sans-serif;font-size:15px;line-height:1.75;max-width:816px;margin:40px auto;padding:0 40px;color:#1e293b}h1{font-size:2em;font-weight:700}h2{font-size:1.5em;font-weight:700}h3{font-size:1.25em;font-weight:600}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:8px 12px}th{background:#f8fafc;font-weight:600}img{max-width:100%}a{color:#4f46e5;text-decoration:underline}blockquote{border-left:3px solid #c7d2fe;padding-left:1em;color:#475569;font-style:italic}code{background:#f1f5f9;border-radius:4px;padding:2px 6px}pre{background:#0f172a;border-radius:8px;padding:16px;color:#e2e8f0}pre code{background:none;color:inherit}</style></head><body>${html}</body></html>`], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${docTitle}.html`; a.click();
            URL.revokeObjectURL(url);
          }} className={`flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`} title="Download as HTML">
            <Download className="w-2.5 h-2.5" /> Export
          </button>
          <span className={`${isDark ? "text-slate-700" : "text-slate-300"}`}>│</span>
          <span>Ctrl+S save</span>
        </div>
      </div>

      {showShortcuts && <ShortcutsPanel isDark={isDark} onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
