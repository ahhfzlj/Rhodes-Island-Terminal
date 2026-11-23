import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Database,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { apiClient } from '../services/apiClient.js';
import type { GameMode } from '../types/index.js';

type AuthTab = 'sms' | 'password' | 'manual';

export const AccountPage: React.FC = () => {
  const {
    gameMode,
    dataMode,
    setDataMode,
    authStatus,
    refreshAll,
    showToast,
  } = useApp();

  const isAk = gameMode === 'arknights';
  const [selectedGame, setSelectedGame] = useState<GameMode>(gameMode);
  const [authTab, setAuthTab] = useState<AuthTab>('sms');

  // Keep selectedGame synced when switching top game pill
  useEffect(() => {
    setSelectedGame(gameMode);
  }, [gameMode]);

  const gameAuth =
    selectedGame === 'arknights' ? authStatus.arknights : authStatus.endfield;
  const targetLabel = selectedGame === 'arknights' ? '明日方舟' : '终末地';

  // SMS login state
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  // Password login state
  const [pwdPhone, setPwdPhone] = useState('');
  const [password, setPassword] = useState('');

  // Manual import state
  const [cred, setCred] = useState('');
  const [signToken, setSignToken] = useState('');
  const [akU8Token, setAkU8Token] = useState('');
  const [endfieldInput, setEndfieldInput] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [syncTask, setSyncTask] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const cardClass = isAk
    ? 'bg-[#13171D] border border-[#293240] p-4 sm:p-5 ak-chamfer-sm'
    : 'ef-frame p-4 sm:p-5';

  const inputClass = isAk
    ? 'w-full px-3 py-2 text-xs sm:text-sm bg-[#0A0C0F] border border-[#293240] focus:border-[#22BBFF] outline-none text-[#ECF0F5]'
    : 'w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#14161A] outline-none text-[#14161A]';

  const primaryBtnClass = isAk
    ? 'px-4 py-2 text-xs sm:text-sm font-bold bg-[#22BBFF] hover:bg-[#49C7FF] text-[#07131A] cursor-pointer disabled:opacity-50'
    : 'px-4 py-2 text-xs sm:text-sm font-black bg-[#FFE600] hover:bg-[#FFF04D] border border-[#14161A] text-[#14161A] cursor-pointer disabled:opacity-50';

  const handleSendCode = async () => {
    if (!/^1\d{10}$/.test(phone.trim())) {
      showToast('请输入有效的 11 位中国大陆手机号', 'error');
      return;
    }
    setSendingCode(true);
    try {
      await apiClient.sendPhoneCode(phone.trim());
      setCountdown(60);
      showToast('短信验证码已发送，请查收', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '发送验证码失败', 'error');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSmsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const json = await apiClient.loginByCode(
        phone.trim(),
        smsCode.trim(),
        selectedGame
      );
      await refreshAll();
      setDataMode('live');
      const warn = json.warnings?.length ? `（提示：${json.warnings[0]}）` : '';
      showToast(`${targetLabel}账号登录成功，已切换至实时模式${warn}`, 'success');
      setSmsCode('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '登录失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const json = await apiClient.loginByPassword(
        pwdPhone.trim(),
        password,
        selectedGame
      );
      await refreshAll();
      setDataMode('live');
      const warn = json.warnings?.length ? `（提示：${json.warnings[0]}）` : '';
      showToast(`${targetLabel}账号登录成功，已切换至实时模式${warn}`, 'success');
      setPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '登录失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.importCred({
        game: selectedGame,
        cred: cred.trim() || undefined,
        signToken: signToken.trim() || undefined,
        akU8Token: selectedGame === 'arknights' ? akU8Token.trim() || undefined : undefined,
        endfieldInput:
          selectedGame === 'endfield' ? endfieldInput.trim() || undefined : undefined,
      });
      await refreshAll();
      setDataMode('live');
      showToast(`${targetLabel}凭证已验证并保存，已切换至实时模式`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入凭证失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectUid = async (uid: string) => {
    try {
      await apiClient.selectUid(selectedGame, uid);
      await refreshAll();
      showToast(`已切换${targetLabel}当前绑定 UID: ${uid}`, 'success');
    } catch {
      showToast('切换 UID 失败', 'error');
    }
  };

  const runSyncAction = async (fn: () => Promise<unknown>, label: string) => {
    setSyncTask(label);
    try {
      await fn();
      await refreshAll();
      setDataMode('live');
      showToast(`${label}完成`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : `${label}失败`, 'error');
    } finally {
      setSyncTask(null);
    }
  };

  const handleLogoutGame = async () => {
    await apiClient.logout(selectedGame);
    await refreshAll();
    showToast(`已退出并清除${targetLabel}本地账号与缓存`, 'info');
  };

  const syncButtons =
    selectedGame === 'arknights'
      ? [
          { action: () => apiClient.syncArknightsProfile(), label: '同步博士档案 & 肉鸽' },
          { action: () => apiClient.syncArknightsGarrison(), label: '同步卫戍协议' },
          { action: () => apiClient.syncArknightsGacha(), label: '同步方舟抽卡' },
        ]
      : [{ action: () => apiClient.syncEndfieldGacha(), label: '同步终末地抽卡' }];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div
          className={`font-mono-tech text-[11px] tracking-widest ${
            isAk ? 'text-[#22BBFF]' : 'text-[#FF5200] font-bold'
          }`}
        >
          HYPERGRYPH PASSPORT // 独立双账号终端
        </div>
        <h1 className="text-xl sm:text-2xl font-black mt-0.5">账号认证与数据同步</h1>
      </div>

      {/* Mode Switch Banner */}
      <section className={cardClass}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 shrink-0 flex items-center justify-center ${
                isAk
                  ? 'bg-[#1A2029] border border-[#293240] text-[#22BBFF]'
                  : 'bg-[#14161A] text-[#FFE600]'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">当前数据源模式</h2>
              <p
                className={`text-xs mt-0.5 ${
                  isAk ? 'text-[#7D899B]' : 'text-[#5C6573]'
                }`}
              >
                演示模式使用内置完整示例数据；明日方舟与终末地支持绑定不同手机号或各自独立登录。
              </p>
            </div>
          </div>

          <div
            className={`inline-flex p-1 shrink-0 ${
              isAk
                ? 'bg-[#0A0C0F] border border-[#293240]'
                : 'bg-[#E2E6EB] border border-[#14161A]'
            }`}
          >
            <button
              type="button"
              onClick={() => setDataMode('demo')}
              className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                dataMode === 'demo'
                  ? isAk
                    ? 'bg-[#FF9A2E] text-[#1A0F03]'
                    : 'bg-[#14161A] text-[#FFE600]'
                  : isAk
                  ? 'text-[#7D899B]'
                  : 'text-[#4A525E]'
              }`}
            >
              演示模式 (DEMO)
            </button>
            <button
              type="button"
              onClick={() => setDataMode('live')}
              className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                dataMode === 'live'
                  ? isAk
                    ? 'bg-[#22BBFF] text-[#07131A]'
                    : 'bg-[#FFE600] text-[#14161A] border border-[#14161A]'
                  : isAk
                  ? 'text-[#7D899B]'
                  : 'text-[#4A525E]'
              }`}
            >
              实时账号 (LIVE)
            </button>
          </div>
        </div>
      </section>

      {/* Independent Account Selector */}
      <section className={cardClass}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-current/10">
          <div>
            <div className="text-xs font-mono-tech opacity-70">ACCOUNT SLOT // 独立账号管理</div>
            <div className="text-sm font-bold mt-0.5">
              选择要管理的账号（两款游戏完全独立存储）
            </div>
          </div>
          <div
            className={`inline-flex p-1 self-start ${
              isAk
                ? 'bg-[#0A0C0F] border border-[#293240]'
                : 'bg-[#E2E6EB] border border-[#14161A]'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedGame('arknights')}
              className={`px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
                selectedGame === 'arknights'
                  ? isAk
                    ? 'bg-[#22BBFF] text-[#07131A]'
                    : 'bg-[#14161A] text-[#FFE600]'
                  : isAk
                  ? 'text-[#7D899B]'
                  : 'text-[#4A525E]'
              }`}
            >
              <span>明日方舟账号</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  authStatus.arknights.authenticated ? 'bg-[#34D399]' : 'bg-current opacity-40'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setSelectedGame('endfield')}
              className={`px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
                selectedGame === 'endfield'
                  ? isAk
                    ? 'bg-[#FF9A2E] text-[#1A0F03]'
                    : 'bg-[#FFE600] text-[#14161A] border border-[#14161A]'
                  : isAk
                  ? 'text-[#7D899B]'
                  : 'text-[#4A525E]'
              }`}
            >
              <span>终末地账号</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  authStatus.endfield.authenticated ? 'bg-[#34D399]' : 'bg-current opacity-40'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Selected Game Binding Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-4 h-4 ${
                gameAuth.authenticated ? 'text-[#34D399]' : 'opacity-50'
              }`}
            />
            <span className="text-sm font-bold">
              {gameAuth.authenticated
                ? `【${targetLabel}】已登录 ${gameAuth.phoneMasked || '手动凭证'}`
                : `【${targetLabel}】尚未接入实时凭证`}
            </span>
          </div>

          {gameAuth.authenticated && (
            <button
              type="button"
              onClick={() => void handleLogoutGame()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#F87171] border border-[#F87171]/40 hover:bg-[#F87171]/10 cursor-pointer self-start"
            >
              <LogOut className="w-3.5 h-3.5" />
              退出{targetLabel}账号
            </button>
          )}
        </div>

        {/* Credential Indicators for Selected Game */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3 text-xs">
          <div
            className={`p-2.5 border ${
              isAk ? 'bg-[#0A0C0F] border-[#293240]' : 'bg-white border-[#C5CCD4]'
            }`}
          >
            <div className="opacity-70 font-mono-tech text-[10px]">SKLAND CRED</div>
            <div className="font-bold mt-0.5">
              {gameAuth.hasSklandCred
                ? `✓ ${targetLabel}森空岛已授权`
                : selectedGame === 'arknights'
                ? '○ 未授权（档案/卫戍/肉鸽）'
                : '○ 未授权（角色绑定）'}
            </div>
          </div>
          <div
            className={`p-2.5 border ${
              isAk ? 'bg-[#0A0C0F] border-[#293240]' : 'bg-white border-[#C5CCD4]'
            }`}
          >
            <div className="opacity-70 font-mono-tech text-[10px]">
              {selectedGame === 'arknights' ? 'ARKNIGHTS U8' : 'ENDFIELD TOKEN'}
            </div>
            <div className="font-bold mt-0.5">
              {gameAuth.hasU8Token
                ? `✓ ${targetLabel}寻访已授权`
                : `○ 未授权（${targetLabel}抽卡分析）`}
            </div>
          </div>
        </div>

        {/* Bound UIDs for Selected Game */}
        {gameAuth.bindings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            <span className="opacity-75">{targetLabel}绑定角色：</span>
            {gameAuth.bindings.map((b) => (
              <button
                key={b.uid}
                type="button"
                onClick={() => void handleSelectUid(b.uid)}
                className={`px-2.5 py-1 font-mono-tech border cursor-pointer ${
                  gameAuth.activeUid === b.uid
                    ? isAk
                      ? 'bg-[#22BBFF]/20 border-[#22BBFF] text-[#22BBFF]'
                      : 'bg-[#FFE600] border-[#14161A] text-[#14161A] font-bold'
                    : isAk
                    ? 'bg-[#0A0C0F] border-[#293240]'
                    : 'bg-white border-[#C5CCD4]'
                }`}
              >
                {b.nickName} ({b.channelName} · {b.uid})
              </button>
            ))}
          </div>
        )}

        {/* Granular Manual Sync Buttons for Selected Game */}
        <div className="flex flex-wrap gap-2 pt-1">
          {syncButtons.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={syncTask !== null}
              onClick={() => void runSyncAction(item.action, item.label)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border cursor-pointer disabled:opacity-50 ${
                isAk
                  ? 'bg-[#1A2029] hover:bg-[#232B37] border-[#394659] text-[#ECF0F5]'
                  : 'bg-white hover:bg-[#FFE600] border-[#14161A] text-[#14161A]'
              }`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncTask === item.label ? 'animate-spin' : ''}`}
              />
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Login / Import Tabs for Selected Game */}
      <section className={cardClass}>
        <div className="text-xs font-mono-tech opacity-75 mb-2">
          TARGET ACCOUNT // 当前正在登录或导入：{targetLabel}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4 border-b border-current/10 pb-3">
          {[
            { id: 'sms' as AuthTab, label: '短信验证码登录（官服）', icon: Smartphone },
            { id: 'password' as AuthTab, label: '账号密码登录', icon: KeyRound },
            { id: 'manual' as AuthTab, label: 'Cred / Token / B服导入', icon: UserCheck },
          ].map((t) => {
            const Icon = t.icon;
            const active = authTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAuthTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold cursor-pointer transition-colors border ${
                  active
                    ? isAk
                      ? 'bg-[#22BBFF] text-[#07131A] border-[#22BBFF]'
                      : 'bg-[#FFE600] text-[#14161A] border-[#14161A]'
                    : isAk
                    ? 'bg-[#0A0C0F] text-[#7D899B] border-[#293240] hover:text-[#ECF0F5]'
                    : 'bg-white text-[#4A525E] border-[#C5CCD4]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: SMS Login */}
        {authTab === 'sms' && (
          <form onSubmit={handleSmsLogin} className="space-y-3 max-w-md">
            <div>
              <label className="block text-xs font-semibold mb-1">
                {targetLabel}鹰角通行证手机号
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入 11 位手机号"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">短信验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="6 位验证码"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={sendingCode || countdown > 0}
                  className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap border cursor-pointer disabled:opacity-50 ${
                    isAk
                      ? 'bg-[#1A2029] border-[#394659] text-[#22BBFF]'
                      : 'bg-[#14161A] border-[#14161A] text-[#FFE600]'
                  }`}
                >
                  {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !phone || !smsCode}
              className={primaryBtnClass}
            >
              {submitting ? '正在验证并交换凭证...' : `登录${targetLabel}并同步绑定`}
            </button>

            <p className={`text-[11px] leading-relaxed ${isAk ? 'text-[#7D899B]' : 'text-[#5C6573]'}`}>
              {apiClient.isNativePlatform()
                ? '所有凭证均仅保存在本机应用本地存储中，直连鹰角官方接口，不会上传至任何第三方服务器。'
                : (
                  <>
                    所有凭证均仅保存在本机 <code className="font-mono-tech">data/store.json</code>，不会上传至任何第三方服务器。
                  </>
                )}
              若官网接口触发人机验证，请切换至「Cred / Token 手动导入」。
            </p>
          </form>
        )}

        {/* Tab 2: Password Login */}
        {authTab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-3 max-w-md">
            <div>
              <label className="block text-xs font-semibold mb-1">
                {targetLabel}手机号
              </label>
              <input
                type="tel"
                value={pwdPhone}
                onChange={(e) => setPwdPhone(e.target.value)}
                placeholder="请输入手机号"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">通行证密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !pwdPhone || !password}
              className={primaryBtnClass}
            >
              {submitting ? '正在登录...' : `密码登录${targetLabel}`}
            </button>
          </form>
        )}

        {/* Tab 3: Manual Import */}
        {authTab === 'manual' && (
          <form onSubmit={handleManualImport} className="space-y-3.5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  森空岛 Cred（可选，绑定 {targetLabel} 角色）
                </label>
                <input
                  type="text"
                  value={cred}
                  onChange={(e) => setCred(e.target.value)}
                  placeholder="粘贴森空岛 cred"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  森空岛 Sign Token（与 Cred 配对）
                </label>
                <input
                  type="text"
                  value={signToken}
                  onChange={(e) => setSignToken(e.target.value)}
                  placeholder="粘贴森空岛签名 token"
                  className={inputClass}
                />
              </div>
            </div>

            {selectedGame === 'arknights' ? (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  明日方舟寻访 U8 Token（可选，用于方舟抽卡记录）
                </label>
                <input
                  type="text"
                  value={akU8Token}
                  onChange={(e) => setAkU8Token(e.target.value)}
                  placeholder="粘贴 u8_token"
                  className={inputClass}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  终末地抽卡记录链接或 Token（支持 ef-webview.hypergryph.com）
                </label>
                <input
                  type="text"
                  value={endfieldInput}
                  onChange={(e) => setEndfieldInput(e.target.value)}
                  placeholder="https://ef-webview.hypergryph.com/api/record/char?..."
                  className={inputClass}
                />
              </div>
            )}

            <button type="submit" disabled={submitting} className={primaryBtnClass}>
              {submitting ? '校验并保存中...' : `验证并保存${targetLabel}凭证`}
            </button>

            {/* Collapsible Guide */}
            <div
              className={`border ${
                isAk ? 'border-[#293240] bg-[#0A0C0F]' : 'border-[#C5CCD4] bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setGuideOpen((v) => !v)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold cursor-pointer"
              >
                <span>B服用户 / Cred 与链接获取方法指引</span>
                {guideOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {guideOpen && (
                <div
                  className={`px-3.5 pb-3 text-xs space-y-1.5 leading-relaxed border-t pt-2.5 ${
                    isAk ? 'border-[#293240] text-[#B4C0D0]' : 'border-[#E2E6EB] text-[#4A525E]'
                  }`}
                >
                  <p>
                    1. <strong>B服 / 森空岛 Cred：</strong> 在电脑浏览器登录森空岛网页版
                    （skland.com），按 F12 打开控制台，从 LocalStorage 或请求头中获取{' '}
                    <code className="font-mono-tech">cred</code> 与对应签名{' '}
                    <code className="font-mono-tech">token</code>（支持查询已绑定的 B服 UID）。
                  </p>
                  <p>
                    2. <strong>终末地抽卡链接：</strong> 在游戏内打开寻访记录界面后，从{' '}
                    <code className="font-mono-tech">HGWebview.log</code> 中复制包含{' '}
                    <code className="font-mono-tech">ef-webview.hypergryph.com</code>{' '}
                    的完整链接粘贴即可。
                  </p>
                  <p>
                    3. <strong>离线 JSON 导入：</strong> 若不便登录，也可在各模块的「导入 JSON」按钮直接导入本地备份文件。
                  </p>
                </div>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
