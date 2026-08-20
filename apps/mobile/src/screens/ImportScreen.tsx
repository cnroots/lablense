import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import type {
  ConfirmedLabValue,
  ImportCandidateStatus,
  Unit
} from "@lablens/core";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import { useAppData } from "../hooks/useAppData";
import { Button, Field, MetaText, Panel, SectionTitle } from "../components/ui";
import { todayIso } from "../utils/date";
import type { OcrProgress } from "../ocr/paddle-mobile-engine";

interface ReviewRow {
  id: string;
  include: boolean;
  analyteId: string | null;
  label: string;
  value: string;
  unitId: string | null;
  unitLabel: string;
  date: string;
  status: ImportCandidateStatus;
}

export function ImportScreen() {
  const { backend, activeUser, refresh } = useBackend();
  const data = useAppData();

  const [phase, setPhase] = useState<"idle" | "recognizing" | "review">("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [batchDate, setBatchDate] = useState(todayIso());
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [unitPickerRowId, setUnitPickerRowId] = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const analytes = useMemo(
    () =>
      data?.analytes.slice().sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "de")
      ) ?? [],
    [data]
  );

  const runOcr = async (uri: string, name: string) => {
    setPhase("recognizing");
    setImageUri(uri);
    setFileName(name);
    setProgress({ phase: "loading-model" });
    try {
      let bytes: Uint8Array;
      try {
        bytes = await new File(uri).bytes();
      } catch (e) {
        throw new Error(
          "[IMAGEREAD] " + (e instanceof Error ? e.message : String(e))
        );
      }
      const extracted = await backend.ocr.recognize(
        { kind: "image", data: bytes, mimeType: "image/jpeg" },
        (p) => setProgress(p)
      );
      const candidates = await backend.import.preview(extracted);
      const today = todayIso();
      const reviewRows: ReviewRow[] = candidates
        .filter((c) => c.status !== "invalid")
        .map((c, i) => ({
          id: `row_${i}`,
          include: c.status === "matched" && !!c.analyte?.analyteId,
          analyteId: c.analyte?.analyteId ?? null,
          label: c.analyte?.displayName ?? c.rawName,
          value: c.parsedValue !== undefined ? String(c.parsedValue) : c.rawValue,
          unitId: c.unit?.unitId ?? null,
          unitLabel: c.unit?.displayName ?? c.rawUnit ?? "",
          date: c.measuredAt ?? today,
          status: c.status
        }));
      setRows(reviewRows);
      setPhase("review");
    } catch (e) {
      Alert.alert(
        "OCR",
        strings.import.errorInit + " " + (e instanceof Error ? e.message : String(e))
      );
      setPhase("idle");
    } finally {
      setProgress(null);
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Kamera", "Kamerazugriff erforderlich.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!res.canceled && res.assets[0]) {
      await runOcr(res.assets[0].uri, "Kameraaufnahme");
    }
  };

  const pickFile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Fotos", "Fotozugriff erforderlich.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      mediaTypes: ["images"]
    });
    if (!res.canceled && res.assets[0]) {
      await runOcr(res.assets[0].uri, res.assets[0].fileName ?? "Bild");
    }
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const assignAnalyte = (analyteId: string) => {
    if (!pickerRowId) return;
    const analyte = analytes.find((a) => a.id === analyteId);
    if (!analyte) return;
    const defaultUnitId = analyte.units[0]?.unitId ?? null;
    const defaultUnitLabel = defaultUnitId
      ? data?.unitsById.get(defaultUnitId)?.displayName ?? ""
      : "";
    updateRow(pickerRowId, {
      analyteId: analyte.id,
      label: analyte.displayName,
      unitId: defaultUnitId,
      unitLabel: defaultUnitLabel
    });
    setPickerRowId(null);
  };

  const assignUnit = (unitId: string | null) => {
    if (!unitPickerRowId) return;
    const unit = unitId ? data?.unitsById.get(unitId) : undefined;
    updateRow(unitPickerRowId, {
      unitId: unit?.id ?? null,
      unitLabel: unit?.displayName ?? ""
    });
    setUnitPickerRowId(null);
  };

  const pickerAnalyte = unitPickerRowId
    ? rows.find((r) => r.id === unitPickerRowId)
    : null;
  const pickerAnalyteRecord = pickerAnalyte?.analyteId
    ? analytes.find((a) => a.id === pickerAnalyte.analyteId)
    : null;

  const pickerUnits = useMemo(() => {
    const all = [...(data?.unitsById.values() ?? [])];
    if (!pickerAnalyteRecord) return all;
    const ids = new Set(pickerAnalyteRecord.units.map((u) => u.unitId));
    const compatible = [...ids]
      .map((id) => data?.unitsById.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
    return compatible.length > 0 ? compatible : all;
  }, [pickerAnalyteRecord, data]);

  const commit = async () => {
    if (!activeUser) return;
    const confirmed: ConfirmedLabValue[] = [];
    for (const row of rows) {
      if (!row.include || !row.analyteId) continue;
      const valueNumeric = Number(row.value.replace(",", "."));
      if (!Number.isFinite(valueNumeric)) continue;
      confirmed.push({
        analyteId: row.analyteId,
        valueNumeric,
        unitId: row.unitId ?? undefined,
        measuredAt: row.date,
        rawName: row.label,
        rawValue: row.value,
        rawUnit: row.unitLabel
      });
    }
    if (confirmed.length === 0) {
      Alert.alert(strings.import.title, strings.import.noRows);
      return;
    }
    const result = await backend.import.commit(activeUser.id, confirmed, {
      sourceType: "ocr"
    });
    refresh();
    setPhase("idle");
    setRows([]);
    setImageUri(null);
    setFileName(null);
    Alert.alert(
      strings.import.title,
      `${result.inserted.length} übernommen, ${result.duplicates.length} Duplikate, ${result.errors.length} Fehler.`
    );
  };

  const addManualRow = () => {
    const first = analytes[0];
    setRows((prev) => [
      ...prev,
      {
        id: `row_manual_${Date.now()}`,
        include: true,
        analyteId: first?.id ?? null,
        label: first?.displayName ?? "",
        value: "",
        unitId: null,
        unitLabel: "",
        date: batchDate,
        status: "matched"
      }
    ]);
  };

  const includedCount = rows.filter((r) => r.include && r.analyteId).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle>{strings.import.title}</SectionTitle>
      <MetaText>
        {strings.import.activeProfile}: {activeUser?.name ?? ""}
      </MetaText>

      <Panel style={styles.panelTop}>
        <Text style={styles.panelTitle}>{strings.import.choosePanel}</Text>
        <MetaText>{strings.import.chooseHint}</MetaText>
        <View style={styles.choiceRow}>
          <Button
            title={strings.import.camera}
            variant="secondary"
            onPress={pickCamera}
          />
          <Button
            title={strings.import.file}
            variant="secondary"
            onPress={pickFile}
          />
        </View>
      </Panel>

      {phase === "recognizing" && (
        <Panel>
          <Text style={styles.panelTitle}>{strings.import.localOcr}</Text>
          <OcrStatusBar progress={progress} />
        </Panel>
      )}

      {phase === "review" && (
        <Panel>
          <View style={styles.reviewHead}>
            <Text style={styles.panelTitle}>{strings.import.reviewTitle}</Text>
            <Button
              title={strings.import.discard}
              variant="secondary"
              onPress={() => {
                setPhase("idle");
                setRows([]);
                setImageUri(null);
              }}
            />
          </View>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : null}
          {fileName ? <MetaText>{fileName}</MetaText> : null}

          <Field
            label={strings.import.defaultDate}
            value={batchDate}
            onChangeText={setBatchDate}
            placeholder="JJJJ-MM-TT"
          />

          {rows
            .filter((r) => r.analyteId !== null)
            .map((row) => (
              <ReviewRowView
                key={row.id}
                row={row}
                onInclude={() => updateRow(row.id, { include: !row.include })}
                onChangeValue={(v) => updateRow(row.id, { value: v })}
                onChangeDate={(d) => updateRow(row.id, { date: d })}
                onPickAnalyte={() => setPickerRowId(row.id)}
                onPickUnit={() => setUnitPickerRowId(row.id)}
              />
            ))}

          {(() => {
            const unassigned = rows.filter((r) => r.analyteId === null);
            if (unassigned.length === 0) return null;
            return (
              <View>
                <TouchableOpacity
                  style={styles.unassignedToggle}
                  onPress={() => setShowUnassigned((v) => !v)}
                >
                  <Text style={styles.unassignedToggleText}>
                    {showUnassigned
                      ? strings.import.hideUnassigned
                      : strings.import.showUnassigned.replace(
                          "{count}",
                          String(unassigned.length)
                        )}
                  </Text>
                  <Text style={styles.unassignedCaret}>
                    {showUnassigned ? "▴" : "▾"}
                  </Text>
                </TouchableOpacity>
                {showUnassigned &&
                  unassigned.map((row) => (
                    <ReviewRowView
                      key={row.id}
                      row={row}
                      onInclude={() => updateRow(row.id, { include: !row.include })}
                      onChangeValue={(v) => updateRow(row.id, { value: v })}
                      onChangeDate={(d) => updateRow(row.id, { date: d })}
                      onPickAnalyte={() => setPickerRowId(row.id)}
                      onPickUnit={() => setUnitPickerRowId(row.id)}
                    />
                  ))}
              </View>
            );
          })()}

          <View style={styles.batchActions}>
            <Button
              title={strings.import.addRow}
              variant="secondary"
              onPress={addManualRow}
            />
            <Button
              title={`${includedCount} ${strings.import.commit}`}
              onPress={commit}
            />
          </View>
        </Panel>
      )}

      <AnalytePickerModal
        visible={pickerRowId !== null}
        analytes={analytes}
        onSelect={assignAnalyte}
        onClose={() => setPickerRowId(null)}
      />

      <UnitPickerModal
        visible={unitPickerRowId !== null}
        units={pickerUnits}
        selectedUnitId={pickerAnalyte?.unitId ?? null}
        onSelect={assignUnit}
        onClose={() => setUnitPickerRowId(null)}
      />
    </ScrollView>
  );
}

function OcrStatusBar({ progress }: { progress: OcrProgress | null }) {
  if (!progress) {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator color={colors.primary} />
        <MetaText>{strings.import.ocrRunning}</MetaText>
      </View>
    );
  }

  if (progress.phase === "loading-model") {
    return (
      <View>
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.primary} />
          <MetaText>{strings.import.ocrLoading}</MetaText>
        </View>
      </View>
    );
  }

  if (progress.phase === "recognizing") {
    const current = (progress.angleIndex ?? 0) + 1;
    const total = progress.angleCount ?? 4;
    const fraction = total > 0 ? current / total : 0;
    return (
      <View>
        <Text style={styles.statusText}>
          {strings.import.ocrStep
            .replace("{current}", String(current))
            .replace("{total}", String(total))}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(fraction * 100)}%` }
            ]}
          />
        </View>
      </View>
    );
  }

  return null;
}

function ReviewRowView({
  row,
  onInclude,
  onChangeValue,
  onChangeDate,
  onPickAnalyte,
  onPickUnit
}: {
  row: ReviewRow;
  onInclude: () => void;
  onChangeValue: (v: string) => void;
  onChangeDate: (d: string) => void;
  onPickAnalyte: () => void;
  onPickUnit: () => void;
}) {
  return (
    <View style={styles.reviewRow}>
      <TouchableOpacity
        style={[styles.checkbox, row.include && styles.checkboxOn]}
        onPress={onInclude}
      >
        {row.include ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </TouchableOpacity>

      <View style={styles.reviewBody}>
        <TouchableOpacity
          style={styles.analytePick}
          onPress={onPickAnalyte}
        >
          <Text style={styles.reviewLabel}>{row.label}</Text>
          <Text style={styles.editGlyph}>✎</Text>
        </TouchableOpacity>
        <View style={styles.reviewInputs}>
          <Field
            value={row.value}
            onChangeText={onChangeValue}
            keyboardType="decimal-pad"
            style={styles.reviewField}
          />
          <Field
            value={row.date}
            onChangeText={onChangeDate}
            placeholder="JJJJ-MM-TT"
            style={styles.reviewField}
          />
        </View>
        <TouchableOpacity style={styles.analytePick} onPress={onPickUnit}>
          <Text style={styles.unitLabel}>{row.unitLabel || "—"}</Text>
          <Text style={styles.editGlyph}>✎</Text>
        </TouchableOpacity>
        <MetaText>
          {row.status === "unmatched" ? " · nicht zugeordnet" : ""}
        </MetaText>
      </View>
    </View>
  );
}

function AnalytePickerModal({
  visible,
  analytes,
  onSelect,
  onClose
}: {
  visible: boolean;
  analytes: { id: string; displayName: string; key: string }[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  React.useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return analytes;
    return analytes.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.key.toLowerCase().includes(q)
    );
  }, [analytes, query]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalShade}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{strings.import.correctAnalyte}</Text>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={strings.import.searchAnalyte}
            placeholderTextColor={colors.textFaint}
          />
          <ScrollView style={styles.pickerList}>
            {filtered.map((analyte) => (
              <TouchableOpacity
                key={analyte.id}
                style={styles.pickerItem}
                onPress={() => onSelect(analyte.id)}
              >
                <Text style={styles.pickerItemText}>{analyte.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button title={strings.edit.cancel} variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function UnitPickerModal({
  visible,
  units,
  selectedUnitId,
  onSelect,
  onClose
}: {
  visible: boolean;
  units: Unit[];
  selectedUnitId: string | null;
  onSelect: (unitId: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  React.useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.ucumCode.toLowerCase().includes(q)
    );
  }, [units, query]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalShade}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{strings.import.correctMetric}</Text>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={strings.import.searchMetric}
            placeholderTextColor={colors.textFaint}
          />
          <ScrollView style={styles.pickerList}>
            {selectedUnitId !== null && (
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => onSelect(null)}
              >
                <Text style={styles.pickerItemText}>
                  {strings.import.noMetric}
                </Text>
              </TouchableOpacity>
            )}
            {filtered.map((unit) => (
              <TouchableOpacity
                key={unit.id}
                style={styles.pickerItem}
                onPress={() => onSelect(unit.id)}
              >
                <Text style={styles.pickerItemText}>{unit.displayName}</Text>
                <MetaText>{unit.ucumCode}</MetaText>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button
            title={strings.edit.cancel}
            variant="secondary"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  panelTop: { marginTop: spacing.sm },
  panelTitle: {
    ...(typography.subheading as object),
    color: colors.text,
    marginBottom: 4
  },
  choiceRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  statusText: { fontSize: 14, color: colors.textMuted, marginBottom: 6 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.divider,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary
  },
  reviewHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: radius.sm,
    marginVertical: spacing.sm,
    backgroundColor: "#FFFFFF"
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkboxMark: { color: "#FFFFFF", fontWeight: "700" },
  reviewBody: { flex: 1, marginLeft: spacing.sm },
  analytePick: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  reviewLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  unitLabel: { fontSize: 13, color: colors.textMuted },
  editGlyph: { fontSize: 13, color: colors.textFaint },
  reviewInputs: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  reviewField: { flex: 1 },
  unassignedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider
  },
  unassignedToggleText: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  unassignedCaret: { fontSize: 14, color: colors.textMuted },
  batchActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  modalShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  modal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: "80%"
  },
  modalTitle: { ...(typography.heading as object), color: colors.text },
  search: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  pickerList: { maxHeight: 360 },
  pickerItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider
  },
  pickerItemText: { fontSize: 15, color: colors.text }
});
