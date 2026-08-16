export const strings = {
  appName: "Laborwerte",
  nav: {
    overview: "Übersicht",
    all: "Alle Werte",
    import: "Import"
  },
  menu: {
    title: "Menü",
    configureHome: "Startseite konfigurieren",
    data: "Daten",
    manageData: "Daten verwalten",
    manageValues: "Laborwerte verwalten",
    references: "Referenzwerte",
    settings: "Einstellungen"
  },
  periods: ["6M", "1J", "3J", "5J", "Alle"] as const,
  overview: {
    average: "Ø",
    outsideReference: "Außerhalb Referenz",
    noValues: "Keine Werte im Zeitraum"
  },
  all: {
    title: "Alle Werte",
    hint: "Wert antippen für Details.",
    searchPlaceholder: "z. B. TSH, Leber …",
    noMatches: "Keine passenden Werte."
  },
  detail: {
    back: "Zurück",
    reference: "Referenz",
    noGeneralRange: "kein allgemeiner Bereich",
    explained: "Kurz erklärt",
    current: "Aktuell",
    periodAverage: "Ø Zeitraum",
    measurements: "Messungen",
    individual: "Einzelmessungen",
    edit: "Bearbeiten",
    outside: "Außerhalb des hinterlegten Referenzbereichs."
  },
  edit: {
    title: "Messung korrigieren",
    date: "Messdatum",
    originalValue: "Interpretierter Originalwert",
    unit: "Einheit auf dem Befund",
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Messung löschen",
    confirmDelete: "Diese einzelne Messung wirklich löschen?"
  },
  import: {
    title: "Import",
    activeProfile: "Aktives Profil",
    choosePanel: "Befund auswählen",
    chooseHint:
      "Foto oder PDF auswählen. Die Befunddatei wird nicht dauerhaft archiviert.",
    camera: "Befund fotografieren",
    file: "PDF / Bild auswählen",
    noFile: "Noch kein Befund ausgewählt.",
    reviewTitle: "Erkannte Werte prüfen",
    discard: "Verwerfen",
    localOcr: "Lokale Texterkennung",
    ocrReady: "Bereit.",
    ocrRunning: "Texterkennung läuft …",
    ocrLoading: "Lade OCR-Modell …",
    ocrStep: "Texterkennung ({current}/{total})",
    correctAnalyte: "Laborwert korrigieren",
    searchAnalyte: "Laborwert suchen …",
    retry: "Erneut erkennen",
    defaultDate: "Standarddatum für manuell hinzugefügte Zeilen",
    addRow: "Wert hinzufügen",
    commit: "Werte übernehmen",
    commitCount: "{count} Werte übernehmen",
    showUnassigned: "Nicht zugeordnete anzeigen ({count})",
    hideUnassigned: "Nicht zugeordnete ausblenden",
    manualTitle: "Einzelwert manuell hinzufügen",
    parameter: "Laborwert",
    date: "Messdatum",
    value: "Wert",
    unit: "Einheit",
    addMeasurement: "Messwert speichern",
    saved: "Messwert gespeichert.",
    commitOk: "Werte übernommen.",
    noRows: "Keine Werte erkannt.",
    errorInit: "OCR-Engine konnte nicht initialisiert werden."
  },
  profiles: {
    title: "Profile verwalten",
    newProfile: "Neues Profil",
    name: "Name",
    add: "Profil hinzufügen",
    active: "Aktiv",
    select: "Wählen",
    delete: "Profil löschen",
    confirmDelete: "Profil wirklich löschen?",
    lastProfile: "Das letzte Profil kann nicht gelöscht werden."
  },
  settings: {
    title: "Einstellungen",
    showRefs: "Referenzlinien anzeigen",
    showRefsHint: "Gestrichelte Orientierungsgrenzen in Diagrammen.",
    highlightOutside: "Außerhalb des Referenzbereichs markieren",
    highlightOutsideHint:
      "Einzelne Punkte werden orange markiert. Die Verlaufslinie bleibt neutral.",
    largeText: "Größere Schrift",
    largeTextHint: "Für bessere Lesbarkeit.",
    privacyTitle: "Datenschutz",
    offline: "Offline im Alltag",
    offlineHint:
      "Messwerte und Auswertungen funktionieren lokal. Die OCR läuft vollständig auf dem Gerät.",
    local: "Lokale Speicherung",
    localHint: "Die Daten bleiben im lokalen App-Speicher.",
    noArchive: "Befunddateien werden nicht archiviert",
    noArchiveHint: "Die ausgewählte Befunddatei wird nicht dauerhaft gespeichert."
  },
  manage: {
    title: "Daten verwalten",
    dataFor: "Daten für",
    localStorage: "Lokale Speicherung",
    localStorageHint:
      "Messwerte werden lokal im App-Speicher abgelegt. Es werden keine Daten an externe Dienste gesendet.",
    noValues: "Keine Messwerte gespeichert.",
    measurementCount: "{count} Messwerte"
  },
  references: {
    title: "Referenzwerte",
    catalogTitle: "Lokaler Referenzkatalog",
    catalogHint:
      "Die App arbeitet vollständig offline. Referenzbereiche dienen der Orientierung und sind keine Diagnose.",
    source: "Quelle"
  },
  config: {
    title: "Startseite konfigurieren",
    apply: "Übernehmen",
    status: "{count} von 6 ausgewählt.",
    limit: "{count} von 6 ausgewählt · Für einen anderen Wert zuerst einen Wert abwählen."
  },
  common: {
    unknown: "unbekannt",
    low: "niedrig",
    normal: "normal",
    high: "hoch",
    sourceLabor: "Labor",
    sourceManual: "Manuell",
    sourceImport: "Import"
  }
} as const;

export type Strings = typeof strings;
