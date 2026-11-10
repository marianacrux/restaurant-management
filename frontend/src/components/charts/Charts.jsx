// Gráficos sencillos en HTML/CSS (sin librerías). Cada gráfico es de UNA sola
// serie: un color, sin leyenda, valores rotulados y tooltip al pasar el cursor.
import styles from './Charts.module.css';

/**
 * Barras horizontales con etiqueta y valor a la derecha (sirve también de tabla).
 * rows: [{ key, label, value:number, display:string, hint?:string }]
 */
export function BarList({ rows, emptyText = 'Sin datos' }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (max === 0) return <p className={styles.empty}>{emptyText}</p>;

  return (
    <ul className={styles.barList}>
      {rows.map((r) => (
        <li key={r.key} className={styles.barRow} data-tip={`${r.label}: ${r.display}${r.hint ? ` · ${r.hint}` : ''}`}>
          <div className={styles.barMeta}>
            <span className={styles.barLabel}>{r.label}</span>
            <span className={styles.barValue}>
              {r.display}
              {r.hint && <span className={styles.barHint}> · {r.hint}</span>}
            </span>
          </div>
          <div className={styles.track}>
            {r.value > 0 && <div className={styles.bar} style={{ width: `${(r.value / max) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Columnas verticales (serie temporal corta). El valor exacto va en el tooltip
 * y en la vista de tabla; solo se rotula el máximo para no saturar.
 * points: [{ key, label, value:number, display:string, hint?:string }]
 */
export function ColumnChart({ points, height = 180, caption }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const peak = points.findIndex((p) => p.value === max && max > 0);

  return (
    <figure className={styles.figure}>
      <div className={styles.columns} style={{ height }} role="img" aria-label={caption}>
        {points.map((p, i) => (
          <div key={p.key} className={styles.column} data-tip={`${p.label}: ${p.display}${p.hint ? ` · ${p.hint}` : ''}`}>
            {i === peak && <span className={styles.peakLabel}>{p.display}</span>}
            <div className={styles.columnBar} style={{ height: max ? `${Math.max((p.value / max) * 100, p.value ? 2 : 0)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className={styles.axis}>
        {points.map((p) => (
          <span key={p.key}>{p.label}</span>
        ))}
      </div>
      <details className={styles.tableToggle}>
        <summary>Ver como tabla</summary>
        <table className={styles.table}>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}>
                <td>{p.label}</td>
                <td>{p.display}</td>
                <td>{p.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
