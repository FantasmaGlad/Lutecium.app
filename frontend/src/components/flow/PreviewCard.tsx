import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AnalyzeResponse, DownloadMode } from '../../lib/api'
import { formatBytes, formatDuration } from '../../lib/format'
import './PreviewCard.css'

export interface DownloadChoice {
  mode: DownloadMode
  formatId?: string
  audioFormat?: string
  subtitleLangs?: string[]
  filename: string
}

interface PreviewCardProps {
  result: AnalyzeResponse
  onDownload: (choice: DownloadChoice) => void
  submitting: boolean
}

export function PreviewCard({ result, onDownload, submitting }: PreviewCardProps) {
  const bestVideo = result.video_formats[result.video_formats.length - 1]
  const bestAudio = result.audio_formats[result.audio_formats.length - 1]

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [videoFormatId, setVideoFormatId] = useState(bestVideo?.format_id ?? '')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [subtitleLangs, setSubtitleLangs] = useState<string[]>([])
  const [filename, setFilename] = useState(result.suggested_filename)

  const selectedVideo = useMemo(
    () => result.video_formats.find((f) => f.format_id === videoFormatId) ?? bestVideo,
    [result.video_formats, videoFormatId, bestVideo],
  )

  const estimatedBytes = selectedVideo?.filesize_bytes ?? bestAudio?.filesize_bytes ?? null

  function toggleSubtitle(lang: string) {
    setSubtitleLangs((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
  }

  return (
    <div className="preview-card">
      <div className="preview-card__meta">
        {result.thumbnail_url && (
          <img className="preview-card__thumb" src={result.thumbnail_url} alt="" />
        )}
        <div className="preview-card__info">
          <span className="preview-card__site">{result.site}</span>
          <p className="preview-card__title">{result.title}</p>
          {result.duration_seconds != null && (
            <span className="preview-card__duration">{formatDuration(result.duration_seconds)}</span>
          )}
        </div>
      </div>

      <div className="preview-card__actions">
        <button
          type="button"
          className="preview-card__button preview-card__button--primary"
          disabled={submitting}
          onClick={() =>
            onDownload({ mode: 'video', formatId: videoFormatId || undefined, filename })
          }
        >
          Télécharger
        </button>
        <button
          type="button"
          className="preview-card__button"
          disabled={submitting || result.audio_formats.length === 0}
          onClick={() => onDownload({ mode: 'audio', audioFormat, filename })}
        >
          Audio seul
        </button>
      </div>

      <p className="preview-card__weight">
        poids estimé : <strong>{formatBytes(estimatedBytes)}</strong>
      </p>

      <button
        type="button"
        className="preview-card__advanced-toggle"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <ChevronDown size={16} className={advancedOpen ? 'preview-card__chevron--open' : ''} aria-hidden="true" />
        Options avancées
      </button>

      {advancedOpen && (
        <div className="preview-card__advanced">
          <label className="preview-card__field">
            <span>Qualité vidéo</span>
            <select value={videoFormatId} onChange={(e) => setVideoFormatId(e.target.value)}>
              {result.video_formats.map((f) => (
                <option key={f.format_id} value={f.format_id}>
                  {f.resolution ?? '?'} · {f.fps ? `${f.fps}fps` : ''} · {f.vcodec ?? ''} ·{' '}
                  {formatBytes(f.filesize_bytes)}
                </option>
              ))}
            </select>
          </label>

          <label className="preview-card__field">
            <span>Format audio</span>
            <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value)}>
              <option value="mp3">mp3</option>
              <option value="m4a">m4a</option>
              <option value="opus">opus</option>
            </select>
          </label>

          {result.subtitles.length > 0 && (
            <fieldset className="preview-card__field">
              <legend>Sous-titres</legend>
              {result.subtitles.map((s) => (
                <label key={s.lang} className="preview-card__checkbox">
                  <input
                    type="checkbox"
                    checked={subtitleLangs.includes(s.lang)}
                    onChange={() => toggleSubtitle(s.lang)}
                  />
                  {s.lang}
                </label>
              ))}
            </fieldset>
          )}

          <label className="preview-card__field">
            <span>Nom de fichier</span>
            <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} />
          </label>

          {subtitleLangs.length > 0 && (
            <button
              type="button"
              className="preview-card__button"
              disabled={submitting}
              onClick={() => onDownload({ mode: 'subtitles', subtitleLangs, filename })}
            >
              Sous-titres seuls
            </button>
          )}
        </div>
      )}
    </div>
  )
}
