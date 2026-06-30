import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function stripHtml(html: string): string {
  if (!html) return "";

  if (typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const docObj = parser.parseFromString(html, "text/html");

      // Unicode character maps for Sans-Serif Bold and Italic
      const toUnicodeStyle = (text: string, style: "bold" | "italic" | "bolditalic"): string => {
        return text
          .split("")
          .map((char) => {
            const code = char.charCodeAt(0);
            if (style === "bolditalic") {
              if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120315);
              if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120309);
            } else if (style === "bold") {
              if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120211);
              if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120205);
              if (code >= 48 && code <= 57) return String.fromCodePoint(code + 120764);
            } else if (style === "italic") {
              if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120263);
              if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120257);
            }
            return char;
          })
          .join("");
      };

      const traverse = (node: Node, activeStyles = { bold: false, italic: false }): string => {
        let result = "";
        const nodeName = node.nodeName.toLowerCase();

        const styles = { ...activeStyles };
        if (nodeName === "strong" || nodeName === "b") styles.bold = true;
        if (nodeName === "em" || nodeName === "i") styles.italic = true;

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          if (styles.bold && styles.italic) {
            return toUnicodeStyle(text, "bolditalic");
          } else if (styles.bold) {
            return toUnicodeStyle(text, "bold");
          } else if (styles.italic) {
            return toUnicodeStyle(text, "italic");
          }
          return text;
        }

        for (let i = 0; i < node.childNodes.length; i++) {
          result += traverse(node.childNodes[i], styles);
        }

        if (nodeName === "p" && node.nextSibling) {
          result += "\n";
        } else if (nodeName === "br") {
          result += "\n";
        }

        return result;
      };

      const plainText = traverse(docObj.body);
      const tempTextarea = document.createElement("textarea");
      tempTextarea.innerHTML = plainText;
      return tempTextarea.value.trim();
    } catch (e) {
      console.error("DOMParser conversion failed, falling back to regex:", e);
    }
  }

  // Fallback for SSR
  return html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}
