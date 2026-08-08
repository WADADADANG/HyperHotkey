import { fullConfig, currentEditProfile, saveCurrentProfile } from './state.js';
import { renderActions, normalizeMode } from './components/actions.js';
import { currentLang, TRANSLATIONS } from './i18n.js';

export function validateProfile(actions) {
  const issues = [];
  if (!actions || !Array.isArray(actions)) return { issues, errorCount: 0, warningCount: 0 };

  const actionIds = new Set(actions.map(a => a.id));

  // Build map of all actions being chained/controlled as sub-actions
  const controlledSubActionIds = new Set();
  actions.forEach(source => {
    if (source.chaining && source.chaining._enabled) {
      Object.keys(source.chaining).forEach(eventKey => {
        if (eventKey === '_enabled') return;
        const targetList = source.chaining[eventKey] || [];
        targetList.forEach(tid => controlledSubActionIds.add(tid));
      });
    }
    if (normalizeMode(source.mode) === 'control' && source.controlTargetIds) {
      source.controlTargetIds.forEach(tid => controlledSubActionIds.add(tid));
    }
  });

  actions.forEach(act => {
    const normMode = normalizeMode(act.mode);

    // 1. Conflicting Trigger Check:
    // If an action is controlled via Action Chain / Control, but ALSO has a key/mouse trigger matching its master trigger
    if (controlledSubActionIds.has(act.id) && act.trigger && act.trigger.type !== 'none' && act.trigger.value) {
      // Find master actions controlling this sub-action
      const masters = actions.filter(m => {
        if (m.id === act.id || !m.trigger || m.trigger.type === 'none') return false;
        let isMaster = false;
        if (m.chaining && m.chaining._enabled) {
          Object.keys(m.chaining).forEach(ev => {
            if (ev !== '_enabled' && (m.chaining[ev] || []).includes(act.id)) isMaster = true;
          });
        }
        const mNorm = normalizeMode(m.mode);
        if (mNorm === 'control' && (m.controlTargetIds || []).includes(act.id)) isMaster = true;
        if (mNorm === 'branch' && m.conditionTargetId === act.id) isMaster = true;
        return isMaster && m.trigger.type === act.trigger.type && m.trigger.value === act.trigger.value;
      });

      if (masters.length > 0) {
        const masterNames = masters.map(m => `"${m.name}"`).join(', ');
        issues.push({
          type: 'conflicting_trigger',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: true,
          messageEn: `Trigger "${act.trigger.value}" conflicts with controlling master ${masterNames}. (Causes double-triggering)`,
          messageTh: `ปุ่ม Trigger "${act.trigger.value}" ซ้ำกับ Master (${masterNames}) ที่ควบคุมมันอยู่ (ทำให้เกิดการซ้ำซ้อน)`
        });
      }
    }

    // 2. Broken Chain References Check:
    if (act.chaining && act.chaining._enabled) {
      Object.keys(act.chaining).forEach(eventKey => {
        if (eventKey === '_enabled') return;
        const targetList = act.chaining[eventKey] || [];
        targetList.forEach(targetId => {
          if (!actionIds.has(targetId)) {
            issues.push({
              type: 'broken_chain',
              severity: 'error',
              actionId: act.id,
              actionName: act.name,
              autoFixable: true,
              eventKey,
              targetId,
              messageEn: `Event [${eventKey}] references a deleted or non-existent action ID ("${targetId}").`,
              messageTh: `เหตุการณ์ [${eventKey}] อ้างอิงถึง Action ID ที่ถูกลบไปแล้ว ("${targetId}")`
            });
          }
        });
      });
    }

    // 3. Unset Target Check for Control & Branch Modes:
    if (normMode === 'control') {
      const targets = act.controlTargetIds || (act.controlTargetId ? [act.controlTargetId] : []);
      const validTargets = targets.filter(tid => actionIds.has(tid));
      if (validTargets.length === 0) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Action Control mode has no target actions selected.`,
          messageTh: `โหมด Action Control ยังไม่ได้เลือก Action เป้าหมาย`
        });
      }
    } else if (normMode === 'branch') {
      if (!act.conditionTargetId || !actionIds.has(act.conditionTargetId)) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Branch mode has no target action selected to check.`,
          messageTh: `โหมด Branch ยังไม่ได้เลือก Action อ้างอิงที่ต้องการเช็ค`
        });
      }
    }

    // 4. Circular Chain Loop Check (Direct self-reference or circular chain):
    if (act.chaining && act.chaining._enabled) {
      Object.keys(act.chaining).forEach(eventKey => {
        if (eventKey === '_enabled') return;
        const targetList = act.chaining[eventKey] || [];
        if (targetList.includes(act.id)) {
          issues.push({
            type: 'circular_chain',
            severity: 'error',
            actionId: act.id,
            actionName: act.name,
            autoFixable: true,
            eventKey,
            targetId: act.id,
            messageEn: `Event [${eventKey}] triggers itself directly, causing an infinite loop.`,
            messageTh: `เหตุการณ์ [${eventKey}] ตั้งทริกเกอร์วนกลับหาตัวเอง ทำให้เกิดลูปไม่สิ้นสุด`
          });
        }
      });
    }
  });

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return { issues, errorCount, warningCount };
}

export function autoFixProfile() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return 0;

  let fixedCount = 0;
  const { issues } = validateProfile(profile.actions);

  issues.forEach(issue => {
    if (!issue.autoFixable) return;

    const act = profile.actions.find(a => a.id === issue.actionId);
    if (!act) return;

    if (issue.type === 'conflicting_trigger') {
      act.trigger = { type: 'none', value: '' };
      fixedCount++;
    } else if (issue.type === 'broken_chain' || issue.type === 'circular_chain') {
      if (act.chaining && act.chaining[issue.eventKey]) {
        act.chaining[issue.eventKey] = act.chaining[issue.eventKey].filter(id => id !== issue.targetId);
        fixedCount++;
      }
    }
  });

  if (fixedCount > 0) {
    saveCurrentProfile();
    renderActions(profile.actions);
  }

  return fixedCount;
}
