"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { CouncilItem } from "@/lib/operating-core";
import type { OperatingTask } from "@/lib/operating-tasks";
import styles from "@/app/operating/operating.module.css";

export function OperatingTasks({recommendations, runId, canCreate}: {recommendations: CouncilItem[]; runId: string | null; canCreate: boolean}) {
  const [tasks, setTasks] = useState<OperatingTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function request(method = "GET", input?: unknown, signal?: AbortSignal) {
    const response = await fetch("/api/operating/tasks", {method, credentials:"same-origin", cache:"no-store", signal,
      ...(input ? {headers:{"Content-Type":"application/json"},body:JSON.stringify(input)} : {})});
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error || "Запит не виконано"}`);
    return result;
  }
  useEffect(() => {
    const controller = new AbortController();
    request("GET", undefined, controller.signal).then(r => {setTasks(r.tasks);setError(null);})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, []);
  async function reload() {
    setLoading(true); setError(null);
    try {setTasks((await request()).tasks);} catch(e) {setError(e instanceof Error ? e.message : "Помилка завантаження");}
    finally {setLoading(false);}
  }
  async function mutate(method: string, input: unknown) {
    setPending(true);setError(null);setNotice(null);
    try {
      const {task} = await request(method,input);
      setTasks(previous => method === "POST" ? [...previous,task] : previous.map(t => t.id === task.id ? task : t));
      setNotice("Збережено в локальному сховищі задач.");
    } catch(e) {setError(e instanceof Error ? e.message : "Не вдалося зберегти. Оновіть список перед повтором.");}
    finally {setPending(false);}
  }
  function save(event: FormEvent<HTMLFormElement>, task: OperatingTask) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim() || null;
    void mutate("PATCH", {id:task.id,revision:task.revision,owner:value("owner"),deadline:value("deadline"),
      status:value("status"),check_date:value("check_date"),result:value("result")});
  }
  return <div className={styles.tasks}>
    <p>Задачі зберігаються локально. Створення задачі не запускає зміну бюджетів, кампаній або production.</p>
    {!canCreate && <p className={styles.warning}>Нові задачі доступні лише з рекомендацій завершеного live-запуску Council.</p>}
    {error && <p role="alert" className={styles.warning}>{error} Дані не вважайте збереженими після помилки.</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" onClick={() => void reload()} disabled={loading || pending}>Оновити список</button>
    {loading && <p role="status">Завантаження задач…</p>}
    {recommendations.length > 0 && <div className={styles.grid}>{recommendations.map(r => {
      const exists = tasks.some(t => t.source_run_id === runId && t.recommendation_id === r.id);
      return <article key={r.id} className={styles.card}><strong>{r.priority} · {r.problem}</strong><p>{r.recommendation}</p>
        <button type="button" disabled={!canCreate || pending || loading || exists} onClick={() => void mutate("POST", {source_run_id:runId,recommendation_id:r.id})}>{exists ? "Задачу створено" : "Створити задачу"}</button></article>;
    })}</div>}
    {!loading && !error && !tasks.length && <p>Збережених задач поки немає.</p>}
    {tasks.map(task => {
      const statuses = ["NEW","IN PROGRESS","DONE","CHECK RESULT"];
      const index = statuses.indexOf(task.status);
      return <form key={`${task.id}:${task.revision}`} onSubmit={event => save(event,task)} className={styles.card}>
        <h3>{task.priority} · {task.problem}</h3><p>{task.recommendation}</p>
        <p className={styles.meta}>Докази: {task.evidence.join(", ")} · Run: {task.source_run_id}</p>
        <p>Очікуваний вплив: {task.expected_impact ?? "не визначено"}</p>
        <p className={styles.meta}>Створено: {task.created_at} · Версія: {task.revision}</p>
        <fieldset disabled={pending} className={styles.fields}>
          <legend>Оновлення задачі</legend>
          <label>Власник<input name="owner" maxLength={200} defaultValue={task.owner ?? ""}/></label>
          <label>Дедлайн<input name="deadline" type="date" defaultValue={task.deadline ?? ""}/></label>
          <label>Статус<select name="status" defaultValue={task.status}>{statuses.filter((_,i) => i === index || i === index + 1).map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Дата перевірки<input name="check_date" type="date" defaultValue={task.check_date ?? ""}/></label>
          <label className={styles.wide}>Результат<textarea name="result" maxLength={4000} rows={3} defaultValue={task.result ?? ""}/></label>
          <p className={styles.wide}>Для IN PROGRESS потрібен власник; для CHECK RESULT — результат і дата перевірки.</p>
          <button type="submit">{pending ? "Збереження…" : "Зберегти"}</button>
        </fieldset>
      </form>;
    })}
  </div>;
}
