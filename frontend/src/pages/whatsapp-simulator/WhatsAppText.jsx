// Muestra texto con el formato básico de WhatsApp (*negrita*, _cursiva_, saltos de línea)
// sin usar dangerouslySetInnerHTML.
const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_)/g;

export default function WhatsAppText({ text }) {
  return text.split('\n').map((line, i) => (
    <span key={i}>
      {line.split(TOKEN).map((part, j) => {
        if (/^\*[^*]+\*$/.test(part)) return <strong key={j}>{part.slice(1, -1)}</strong>;
        if (/^_[^_]+_$/.test(part)) return <em key={j}>{part.slice(1, -1)}</em>;
        return part;
      })}
      {i < text.split('\n').length - 1 && <br />}
    </span>
  ));
}
