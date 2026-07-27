import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  getMissionByNumero,
  getQuestions,
  getAnswers,
  saveAnswers,
  completeMission,
  type Mission,
  type Question,
  type Categoria,
} from '../lib/missions';

// Nombre visible de cada bloque, en el orden en que se muestran.
const BLOQUES: { categoria: Categoria; titulo: string }[] = [
  { categoria: 'iniciacion', titulo: 'Preguntas Iniciales' },
  { categoria: 'actividad', titulo: 'Mini-Acción' },
  { categoria: 'reflexion', titulo: 'Preguntas de Reflexión' },
];

export default function MissionPage() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mission, setMission] = useState<Mission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingBlock, setSavingBlock] = useState<Categoria | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tokenWon, setTokenWon] = useState(false);

  useEffect(() => {
    const n = Number(numero);
    setLoading(true);
    (async () => {
      const m = await getMissionByNumero(n);
      setMission(m);
      if (!m) {
        setLoading(false);
        return;
      }
      const qs = await getQuestions(m.id);
      setQuestions(qs);
      const saved = await getAnswers(qs.map((q) => q.id));
      setAnswers(saved);
      setLoading(false);
    })().catch((e) => {
      setMsg(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });
  }, [numero]);

  function setResp(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function guardarBloque(categoria: Categoria) {
    if (!user) return;
    setMsg(null);
    setSavingBlock(categoria);
    try {
      const entries = questions
        .filter((q) => q.categoria === categoria)
        .map((q) => ({ question_id: q.id, respuesta: answers[q.id] ?? '' }));
      await saveAnswers(user.id, entries);
      setMsg('Guardado ✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBlock(null);
    }
  }

  async function obtenerToken() {
    if (!mission || !user) return;
    setMsg(null);
    setClaiming(true);
    try {
      // Guardar todo antes de reclamar, por si quedó algo sin guardar.
      await saveAnswers(
        user.id,
        questions.map((q) => ({ question_id: q.id, respuesta: answers[q.id] ?? '' }))
      );
      const ok = await completeMission(mission.id);
      if (ok) {
        setTokenWon(true);
        setMsg('¡Token obtenido! 🪙');
      } else {
        setMsg('Aún faltan preguntas por responder para obtener el token.');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return <div className="auth-loading">Cargando misión…</div>;

  if (!mission)
    return (
      <main className="mission">
        <p>Esta misión aún no está disponible.</p>
        <button className="mission-back" onClick={() => navigate('/forest')}>
          ← Volver al mapa
        </button>
      </main>
    );

  return (
    <main className="mission">
      <button className="mission-back" onClick={() => navigate('/forest')}>
        ← Volver al mapa
      </button>

      <h1 className="mission-title">
        Misión {mission.numero}: {mission.titulo}
      </h1>
      <p className="mission-desc">{mission.descripcion}</p>

      {BLOQUES.map(({ categoria, titulo }) => {
        const qs = questions.filter((q) => q.categoria === categoria);
        if (qs.length === 0) return null;
        return (
          <section key={categoria} className="mission-block">
            <h2>{titulo}</h2>
            {qs.map((q) => (
              <div key={q.id} className="mission-q">
                <label className="mission-q-text">{q.enunciado}</label>
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setResp(q.id, e.target.value)}
                  rows={categoria === 'actividad' ? 6 : 3}
                  placeholder="Escribe tu respuesta…"
                />
              </div>
            ))}
            <button
              className="mission-save"
              onClick={() => guardarBloque(categoria)}
              disabled={savingBlock === categoria}
            >
              {savingBlock === categoria ? 'Guardando…' : 'Guardar'}
            </button>
          </section>
        );
      })}

      <section className="mission-final">
        <p className="mission-final-text">{mission.texto_final}</p>
        {msg && <p className="mission-msg">{msg}</p>}

        {tokenWon ? (
          <div className="mission-token-won">🪙 Token obtenido</div>
        ) : (
          <button
            className="mission-token-btn"
            onClick={obtenerToken}
            disabled={claiming}
          >
            {claiming ? 'Validando…' : 'Obtener mi token'}
          </button>
        )}

        <button className="mission-back" onClick={() => navigate('/forest')}>
          Volver al mapa
        </button>
      </section>
    </main>
  );
}
