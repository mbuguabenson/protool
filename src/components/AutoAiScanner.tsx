import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import classNames from 'classnames';
import { derivWebSocket } from '../lib/deriv-api-v1/deriv-websocket-manager';
import { analyzeMultiWindow, type MultiWindowAnalysis } from '../lib/autoai/analysis';
import { generateCombinedRankedSignals, type Signal } from '../lib/autoai/signals';
import { SYMBOLS } from '../lib/autoai/symbols';
import { useGlobalToggle } from '../hooks/useGlobalToggle';
import './AutoAiScanner.scss';

type Step = 'orb' | 'config' | 'scanning' | 'result' | 'executing';

type SubscriptionState = {
  symbol: string;
  ticks: number[];
  quotes: number[];
};

const TRADE_TYPES = [
  { id: 'over_under', label: 'Over / Under', types: ['over_under', 'pro_over_under', 'under_7', 'over_2'] as const },
  { id: 'even_odd', label: 'Even / Odd', types: ['even_odd', 'pro_even_odd', 'under_7', 'over_2'] as const },
  { id: 'matches', label: 'Matches', types: ['matches', 'under_7', 'over_2'] as const },
  { id: 'differs', label: 'Differs', types: ['differs', 'under_7', 'over_2'] as const },
  { id: 'rise_fall', label: 'Rise / Fall', types: ['rise_fall', 'under_7', 'over_2'] as const },
];

// --- Draggable Orb Hook ---
function useDraggableOrb() {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const raf = useRef(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    dragging.current = true;
    setIsDragging(true);
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    lastTime.current = performance.now();
    velocity.current = { x: 0, y: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const now = performance.now();
    const dt = Math.max(now - lastTime.current, 1);
    const newX = e.clientX - offset.current.x;
    const newY = e.clientY - offset.current.y;
    velocity.current = {
      x: ((newX - pos.current.x) / dt) * 16,
      y: ((newY - pos.current.y) / dt) * 16,
    };
    pos.current = { x: newX, y: newY };
    lastTime.current = now;
    setPosition({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);

    // Spring physics
    let vx = velocity.current.x;
    let vy = velocity.current.y;
    let px = pos.current.x;
    let py = pos.current.y;
    const decay = 0.92;

    const animate = () => {
      if (dragging.current) return;
      vx *= decay;
      vy *= decay;
      px += vx;
      py += vy;

      // Boundary bounce
      const w = window.innerWidth;
      const h = window.innerHeight;
      const size = 72;
      if (px < 0) { px = 0; vx = Math.abs(vx) * 0.5; }
      if (px > w - size) { px = w - size; vx = -Math.abs(vx) * 0.5; }
      if (py < 0) { py = 0; vy = Math.abs(vy) * 0.5; }
      if (py > h - size) { py = h - size; vy = -Math.abs(vy) * 0.5; }

      pos.current = { x: px, y: py };
      setPosition({ x: px, y: py });

      if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
        raf.current = requestAnimationFrame(animate);
      }
    };
    raf.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Center the orb initially
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = w / 2 - 36;
    const y = h / 2 - 36;
    pos.current = { x, y };
    setPosition({ x, y });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return { ref, position, isDragging, onPointerDown, onPointerMove, onPointerUp };
}

function SignalValue({ width }: { width: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.width = `${Math.min(Math.max(width, 0), 100)}%`;
  }, [width]);

  return <div ref={ref} className="auto-ai-scanner__signal-value" />;
}

type AutoAiBotXmlOptions = {
  selectedTradeType: string;
  selectedSymbol: string;
  selectedSignal: Signal | null;
  stake: string;
  takeProfit: string;
  stopLoss: string;
  martingale: string;
  speedMode: boolean;
};

function getTradeTypeDefaults(selectedTradeType: string) {
  switch (selectedTradeType) {
    case 'even_odd':
    case 'pro_even_odd':
      return { tradeTypeCat: 'digits', tradeType: 'evenodd', defaultContractType: 'DIGITEVEN' };
    case 'matches':
      return { tradeTypeCat: 'digits', tradeType: 'matchdiff', defaultContractType: 'DIGITMATCH' };
    case 'differs':
      return { tradeTypeCat: 'digits', tradeType: 'matchdiff', defaultContractType: 'DIGITDIFF' };
    case 'rise_fall':
      return { tradeTypeCat: 'callput', tradeType: 'risefall', defaultContractType: 'CALL' };
    case 'under_7':
      return { tradeTypeCat: 'digits', tradeType: 'overunder', defaultContractType: 'DIGITUNDER' };
    case 'over_2':
      return { tradeTypeCat: 'digits', tradeType: 'overunder', defaultContractType: 'DIGITOVER' };
    default:
      return { tradeTypeCat: 'digits', tradeType: 'overunder', defaultContractType: 'DIGITOVER' };
  }
}

function resolveSignalContract(selectedSignal: Signal | null, selectedTradeType: string) {
  const defaults = getTradeTypeDefaults(selectedTradeType);
  let contractType = defaults.defaultContractType;
  let prediction = '';

  if (selectedSignal?.tradeDirection) {
    const direction = selectedSignal.tradeDirection.toUpperCase();
    if (selectedSignal.type === 'even_odd' || ['even_odd', 'pro_even_odd'].includes(selectedTradeType)) {
      contractType = direction === 'ODD' ? 'DIGITODD' : 'DIGITEVEN';
    } else if (selectedSignal.type === 'matches') {
      contractType = 'DIGITMATCH';
    } else if (selectedSignal.type === 'differs') {
      contractType = 'DIGITDIFF';
    } else if (selectedSignal.type === 'rise_fall') {
      contractType = direction === 'FALL' ? 'PUT' : 'CALL';
    } else if (direction.includes('UNDER')) {
      contractType = 'DIGITUNDER';
    } else if (direction.includes('OVER')) {
      contractType = 'DIGITOVER';
    }

    if (['over_under', 'pro_over_under', 'under_7', 'over_2', 'matches', 'differs'].includes(selectedSignal.type)) {
      prediction = selectedSignal.targetDigit?.toString() ?? '';
    }
  }

  if (!prediction && ['matches', 'differs'].includes(selectedTradeType)) {
    prediction = '5';
  }
  if (!prediction && ['under_7'].includes(selectedTradeType)) {
    prediction = '7';
  }
  if (!prediction && ['over_2'].includes(selectedTradeType)) {
    prediction = '2';
  }
  if (!prediction && selectedTradeType === 'over_under') {
    prediction = '7';
  }

  const hasPrediction = ['overunder', 'matchdiff'].includes(defaults.tradeType);
  if (!hasPrediction) {
    prediction = '';
  }

  return { contractType, prediction, hasPrediction, tradeTypeCat: defaults.tradeTypeCat, tradeType: defaults.tradeType };
}

function buildEntryLogicSignal(
  selectedSignal: Signal | null,
  selectedTradeType: string,
  contractType: string,
  predictionValue: string,
  speedMode: boolean
) {
  let purchaseType = contractType;
  let compareOp = 'GTE';
  let compareValue = '0';
  let hasComparison = true;

  const signalType = selectedSignal?.type ?? selectedTradeType;
  const direction = selectedSignal?.tradeDirection?.toUpperCase() ?? '';
  const targetDigit = selectedSignal?.targetDigit?.toString() ?? predictionValue;

  switch (signalType) {
    case 'matches':
      purchaseType = 'DIGITMATCH';
      compareOp = 'EQ';
      compareValue = targetDigit;
      break;
    case 'differs':
      purchaseType = 'DIGITDIFF';
      compareOp = 'NEQ';
      compareValue = targetDigit;
      break;
    case 'over_under':
    case 'pro_over_under':
      purchaseType = direction.includes('UNDER') ? 'DIGITUNDER' : 'DIGITOVER';
      compareOp = direction.includes('UNDER') ? 'LT' : 'GT';
      compareValue = targetDigit || '4';
      break;
    case 'under_7':
      purchaseType = 'DIGITUNDER';
      compareOp = 'LT';
      compareValue = targetDigit || '7';
      break;
    case 'over_2':
      purchaseType = 'DIGITOVER';
      compareOp = 'GT';
      compareValue = targetDigit || '2';
      break;
    case 'rise_fall':
      purchaseType = direction.includes('FALL') ? 'PUT' : 'CALL';
      compareOp = direction.includes('FALL') ? 'LT' : 'GT';
      compareValue = '4';
      break;
    case 'even_odd':
    case 'pro_even_odd':
      purchaseType = direction === 'ODD' ? 'DIGITODD' : 'DIGITEVEN';
      compareOp = 'GTE';
      compareValue = '0';
      break;
    default:
      purchaseType = contractType;
      compareOp = 'GTE';
      compareValue = '0';
  }

  const purchaseBlock = `
      <statement name="DO0">
        <block type="purchase" id="bp_pur1">
          <field name="PURCHASE_LIST">${purchaseType}</field>
        </block>
      </statement>`;

  if (speedMode) {
    return `
  <block type="before_purchase" id="bp1" deletable="false" x="0" y="560">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="bp_pur1">
        <field name="PURCHASE_LIST">${purchaseType}</field>
      </block>
    </statement>
  </block>`;
  }

  return `
  <block type="before_purchase" id="bp1" deletable="false" x="0" y="560">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="bp_if1">
        <value name="IF0">
          <block type="logic_compare" id="bp_cmp1">
            <field name="OP">${compareOp}</field>
            <value name="A">
              <block type="last_digit" id="bp_ld1"></block>
            </value>
            <value name="B">
              <block type="math_number" id="bp_mn1">
                <field name="NUM">${compareValue}</field>
              </block>
            </value>
          </block>
        </value>${purchaseBlock}
      </block>
    </statement>
  </block>`;
}

function generateAutoAiBotXml({
  selectedTradeType,
  selectedSymbol,
  selectedSignal,
  stake,
  takeProfit,
  stopLoss,
  martingale,
  speedMode,
}: AutoAiBotXmlOptions) {
  const { tradeTypeCat, tradeType, contractType, prediction, hasPrediction } = resolveSignalContract(
    selectedSignal,
    selectedTradeType,
  );
  const predictionValue = prediction || (tradeType === 'overunder' ? '7' : '5');
  const predictionInput = hasPrediction
    ? `
        <value name="PREDICTION">
          <shadow type="math_number_positive">
            <field name="NUM">${predictionValue}</field>
          </shadow>
        </value>`
    : '';
  const beforePurchaseXml = buildEntryLogicSignal(selectedSignal, selectedTradeType, contractType, predictionValue, speedMode);

  const afterPurchaseXml = `
  <block type="after_purchase" id="ap1" x="0" y="700">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="ap_if1">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="ccr1">
            <field name="CHECK_RESULT">win</field>
          </block>
        </value>
        <statement name="DO0">
          <block type="variables_set" id="vs_ap1">
            <field name="VAR" id="v_stake">Stake</field>
            <value name="VALUE">
              <block type="variables_get" id="vg_ap1">
                <field name="VAR" id="v_init_stake">Initial Stake</field>
              </block>
            </value>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set" id="vs_ap2">
            <field name="VAR" id="v_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic" id="ma_ap1">
                <field name="OP">MULTIPLY</field>
                <value name="A">
                  <block type="variables_get" id="vg_ap2">
                    <field name="VAR" id="v_stake">Stake</field>
                  </block>
                </value>
                <value name="B">
                  <block type="variables_get" id="vg_ap3">
                    <field name="VAR" id="v_mg">Martingale</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </statement>
        <next>
          <block type="controls_if" id="ap_if2">
            <mutation else="1"></mutation>
            <value name="IF0">
              <block type="logic_compare" id="lc_ap1">
                <field name="OP">LT</field>
                <value name="A">
                  <block type="total_profit" id="tp_ap1"></block>
                </value>
                <value name="B">
                  <block type="variables_get" id="vg_ap4">
                    <field name="VAR" id="v_tp">Take Profit</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="controls_if" id="ap_if3">
                <mutation else="1"></mutation>
                <value name="IF0">
                  <block type="logic_compare" id="lc_ap2">
                    <field name="OP">GT</field>
                    <value name="A">
                      <block type="total_profit" id="tp_ap2"></block>
                    </value>
                    <value name="B">
                      <block type="math_single" id="ms_ap1">
                        <field name="OP">NEG</field>
                        <value name="NUM">
                          <block type="variables_get" id="vg_ap5">
                            <field name="VAR" id="v_sl">Stop Loss</field>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="trade_again" id="ta_ap1"></block>
                </statement>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="v_stake">Stake</variable>
    <variable id="v_init_stake">Initial Stake</variable>
    <variable id="v_tp">Take Profit</variable>
    <variable id="v_sl">Stop Loss</variable>
    <variable id="v_mg">Martingale</variable>
  </variables>
  <block type="trade_definition" id="td_main" deletable="false" x="0" y="40">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="tdm1" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${selectedSymbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="tdt1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">${tradeTypeCat}</field>
            <field name="TRADETYPE_LIST">${tradeType}</field>
            <next>
              <block type="trade_definition_contracttype" id="tdct1" deletable="false" movable="false">
                <field name="TYPE_LIST">${contractType}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="tdci1" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="tdrbs1" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="tdroe1" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="vs_stake">
        <field name="VAR" id="v_stake">Stake</field>
        <value name="VALUE">
          <block type="math_number_positive" id="mn_stake">
            <field name="NUM">${stake}</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="vs_init_stake">
            <field name="VAR" id="v_init_stake">Initial Stake</field>
            <value name="VALUE">
              <block type="math_number_positive" id="mn_init_stake">
                <field name="NUM">${stake}</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="vs_tp">
                <field name="VAR" id="v_tp">Take Profit</field>
                <value name="VALUE">
                  <block type="math_number_positive" id="mn_tp">
                    <field name="NUM">${takeProfit}</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="vs_sl">
                    <field name="VAR" id="v_sl">Stop Loss</field>
                    <value name="VALUE">
                      <block type="math_number_positive" id="mn_sl">
                        <field name="NUM">${stopLoss}</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="vs_mg">
                        <field name="VAR" id="v_mg">Martingale</field>
                        <value name="VALUE">
                          <block type="math_number_positive" id="mn_mg">
                            <field name="NUM">${martingale}</field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="tdto1">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="${hasPrediction}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION">
          <shadow type="math_number_positive" id="mn_duration">
            <field name="NUM">1</field>
          </shadow>
        </value>
        <value name="AMOUNT">
          <shadow type="math_number_positive" id="mn_amount">
            <field name="NUM">${stake}</field>
          </shadow>
        </value>${predictionInput}
      </block>
    </statement>
  </block>
  ${beforePurchaseXml}
  ${afterPurchaseXml}
</xml>`;
}

// --- Main Scanner ---
export default function AutoAiScanner({
  onLoadBot,
  onLoadAndRun,
}: {
  onLoadBot?: (xml: string) => void;
  onLoadAndRun?: (xml: string) => void;
}) {
  const [step, setStep] = useState<Step>('orb');
  const [selectedSymbol, setSelectedSymbol] = useState('1HZ100V');
  const [selectedTradeType, setSelectedTradeType] = useState('over_under');
  const [stake, setStake] = useState('1');
  const [takeProfit, setTakeProfit] = useState('10');
  const [stopLoss, setStopLoss] = useState('5');
  const [martingale, setMartingale] = useState('2');
  const [speedMode, setSpeedMode] = useGlobalToggle({ key: 'autoai_speed_mode', defaultValue: false });
  const [multiMarket, setMultiMarket] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTarget, setScanTarget] = useState(1);
  const [mwa, setMwa] = useState<MultiWindowAnalysis | null>(null);
  const [combinedSignals, setCombinedSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(derivWebSocket.isConnected());
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState | null>(null);
  const [orbVisible, setOrbVisible] = useState(true);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const subscriptionIdRef = useRef<string | null>(null);

  const orb = useDraggableOrb();

  useEffect(() => {
    if (orb.ref.current) {
      orb.ref.current.style.transform = `translate(${orb.position.x}px, ${orb.position.y}px)`;
    }
  }, [orb.position]);

  useEffect(() => {
    const unsubscribe = derivWebSocket.onConnectionStatus((status) => {
      setIsConnected(status === 'connected');
    });

    const ensureConnected = async () => {
      if (!derivWebSocket.isConnected()) {
        try {
          await derivWebSocket.connect();
          setIsConnected(true);
        } catch {
          setIsConnected(false);
        }
      }
    };

    ensureConnected();
    const keepAliveId = window.setInterval(() => {
      if (!derivWebSocket.isConnected()) {
        void derivWebSocket.connect().catch(() => {
          setIsConnected(false);
        });
      }
    }, 5000);

    return () => {
      clearInterval(keepAliveId);
      unsubscribe();
      if (subscriptionIdRef.current) {
        derivWebSocket.unsubscribe(subscriptionIdRef.current).catch(() => undefined);
        subscriptionIdRef.current = null;
      }
    };
  }, []);

  const subscribeSymbol = useCallback(
    async (symbol: string) => {
      setSubscriptionState({ symbol, ticks: [], quotes: [] });

      if (subscriptionIdRef.current) {
        await derivWebSocket.unsubscribe(subscriptionIdRef.current).catch(() => undefined);
        subscriptionIdRef.current = null;
      }

      if (!derivWebSocket.isConnected()) {
        try {
          await derivWebSocket.connect();
        } catch {
          setIsConnected(false);
          return;
        }
      }

      try {
        const history = await derivWebSocket.getTicksHistory(symbol, 1000);
        setSubscriptionState({
          symbol,
          ticks: history.map((tick) => tick.lastDigit),
          quotes: history.map((tick) => tick.quote),
        });
      } catch {
        setSubscriptionState((prev) => (prev ? { ...prev, ticks: [], quotes: [] } : null));
      }

      const callback = (tick: { quote: number; lastDigit: number; epoch: number; symbol: string }) => {
        if (tick.symbol !== symbol) return;
        setSubscriptionState((prev) => {
          if (!prev || prev.symbol !== symbol) return prev;
          const nextTicks = [...prev.ticks, tick.lastDigit].slice(-1000);
          const nextQuotes = [...prev.quotes, tick.quote].slice(-1000);
          return { ...prev, ticks: nextTicks, quotes: nextQuotes };
        });
      };

      const subscriptionId = await derivWebSocket.subscribeTicks(symbol, callback);
      subscriptionIdRef.current = subscriptionId || null;
    },
    []
  );

  useEffect(() => {
    if (!progressRef.current) return;
    const width = scanTarget > 0 ? (scanProgress / scanTarget) * 100 : 0;
    progressRef.current.style.width = `${Math.min(Math.max(width, 0), 100)}%`;
  }, [scanProgress, scanTarget]);

  const allowedTypes = useMemo(() => {
    const tt = TRADE_TYPES.find((t) => t.id === selectedTradeType);
    return tt?.types ?? [];
  }, [selectedTradeType]);

  useEffect(() => {
    if (!subscriptionState || subscriptionState.ticks.length < 20) return;
    const result = analyzeMultiWindow(subscriptionState.ticks, subscriptionState.quotes);
    setMwa(result);
    setCombinedSignals(generateCombinedRankedSignals(result, allowedTypes));
  }, [subscriptionState?.ticks.length, allowedTypes]);

  const startScan = useCallback(() => {
    setStep('scanning');
    setScanProgress(0);
    const targets = multiMarket ? SYMBOLS.length : 1;
    setScanTarget(targets);
    let i = 0;

    const runStep = async () => {
      i++;
      setScanProgress(i);
      if (multiMarket) {
        const sym = SYMBOLS[i - 1];
        if (sym) {
          await subscribeSymbol(sym.id);
        }
      } else {
        await subscribeSymbol(selectedSymbol);
      }
      if (i >= targets) {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
        setTimeout(() => setStep('result'), 600);
      }
    };

    scanIntervalRef.current = window.setInterval(() => {
      void runStep();
    }, 400);
  }, [multiMarket, selectedSymbol, subscribeSymbol]);

  useEffect(() => {
    if (step === 'result' && combinedSignals.length > 0 && !selectedSignal) {
      setSelectedSignal(combinedSignals[0]);
      setStep('executing');
    }
  }, [step, combinedSignals, selectedSignal]);

  useEffect(() => {
    if (step === 'executing') {
      const timer = setTimeout(() => {
        handleLoadAndRunInternal();
        setStep('orb');
        setOrbVisible(true);
        setMinimized(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step]); // handleLoadAndRunInternal omitted from dep array to avoid repeated triggers if it changes

  const resetScan = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (subscriptionIdRef.current) {
      derivWebSocket.unsubscribe(subscriptionIdRef.current).catch(() => undefined);
      subscriptionIdRef.current = null;
    }
    setStep('config');
    setScanProgress(0);
    setMwa(null);
    setSelectedSignal(null);
  }, []);

  const handleLoadBotInternal = useCallback(() => {
    const signalToUse = selectedSignal || combinedSignals[0] || null;
    const xml = generateAutoAiBotXml({
      selectedTradeType,
      selectedSymbol,
      selectedSignal: signalToUse,
      stake,
      takeProfit,
      stopLoss,
      martingale,
      speedMode,
    });
    if (onLoadBot) onLoadBot(xml);
  }, [selectedTradeType, stake, takeProfit, stopLoss, martingale, speedMode, selectedSymbol, selectedSignal, combinedSignals, onLoadBot]);

  const handleLoadAndRunInternal = useCallback(() => {
    const signalToUse = selectedSignal || combinedSignals[0] || null;
    const xml = generateAutoAiBotXml({
      selectedTradeType,
      selectedSymbol,
      selectedSignal: signalToUse,
      stake,
      takeProfit,
      stopLoss,
      martingale,
      speedMode,
    });
    if (onLoadAndRun) onLoadAndRun(xml);
  }, [selectedTradeType, stake, takeProfit, stopLoss, martingale, speedMode, selectedSymbol, selectedSignal, combinedSignals, onLoadAndRun]);

  const selectedSymbolInfo = SYMBOLS.find((s) => s.id === selectedSymbol);
  const lastDigit = mwa?.lastDigit ?? null;

  // Clicking orb toggles the panel
  const handleOrbClick = useCallback(() => {
    if (orb.isDragging) return; // don't open when dragging
    if (step === 'orb') {
      setOrbVisible(false);
      setStep('config');
    } else {
      setStep('orb');
      setMinimized(false);
      setOrbVisible(true);
    }
  }, [orb.isDragging, step]);

  useEffect(() => {
    if (!orb.ref.current) return;
    orb.ref.current.style.transform = `translate(${orb.position.x}px, ${orb.position.y}px)`;
  }, [orb.position]);

  useEffect(() => {
    if (!progressRef.current) return;
    const width = scanTarget > 0 ? (scanProgress / scanTarget) * 100 : 0;
    progressRef.current.style.width = `${Math.min(Math.max(width, 0), 100)}%`;
  }, [scanProgress, scanTarget]);

  // --- Floating Orb ---
  const orbEl = orbVisible ? (
    <div
      ref={orb.ref}
      className={classNames('auto-ai-scanner__orb', {
        'auto-ai-scanner__orb--dragging': orb.isDragging,
      })}
      onPointerDown={orb.onPointerDown}
      onPointerMove={orb.onPointerMove}
      onPointerUp={orb.onPointerUp}
      onClick={handleOrbClick}
    >
      <div className="auto-ai-scanner__orb-glow" />
      <div className="auto-ai-scanner__orb-body">
        <div className="auto-ai-scanner__orb-shine" />
        <span className="auto-ai-scanner__orb-text">{step === 'orb' ? 'SCAN' : 'LIVE'}</span>
        <div
          className={classNames('auto-ai-scanner__orb-status', {
            'auto-ai-scanner__orb-status--connected': isConnected,
          })}
        />
      </div>
    </div>
  ) : null;

  // --- Scanner Panel ---
  const panel = step !== 'orb' && (
    <div ref={panelRef} className="auto-ai-scanner__panel">
      <div className="auto-ai-scanner__panel-header">
        <div className="auto-ai-scanner__panel-title">
          <span>aut</span>
          <span className="auto-ai-scanner__title-highlight">ai</span>
        </div>
        <div className="auto-ai-scanner__connection">
          <div
            className={classNames('auto-ai-scanner__connection-dot', {
              'auto-ai-scanner__connection-dot--connected': isConnected,
            })}
          />
          <span>{isConnected ? 'Live' : 'Reconnecting...'}</span>
        </div>
        <div className="auto-ai-scanner__panel-controls">
          <button type="button" className="auto-ai-scanner__panel-button" onClick={() => setMinimized((v) => !v)}>
            {minimized ? '□' : '−'}
          </button>
          <button
            type="button"
            className="auto-ai-scanner__panel-button"
            onClick={() => {
              setStep('orb');
              setOrbVisible(true);
            }}
          >
            ✕
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="auto-ai-scanner__panel-body">
          {step === 'config' && (
            <div className="auto-ai-scanner__row">
              <div>
                <label className="auto-ai-scanner__label">Market</label>
                <div className="auto-ai-scanner__field">
                  <button
                    type="button"
                    className="auto-ai-scanner__select-button"
                    onClick={() => setShowSymbolPicker((v) => !v)}
                  >
                    {selectedSymbolInfo?.label ?? selectedSymbol}
                    <span>▼</span>
                  </button>
                  {showSymbolPicker && (
                    <div className="auto-ai-scanner__picker">
                      {['Volatility', 'Crash/Boom', 'Jump', 'Bear/Bull', 'Range', 'Step'].map((cat) => (
                        <div key={cat}>
                          <div className="auto-ai-scanner__picker-heading">{cat}</div>
                          {SYMBOLS.filter((s) => s.category === cat).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={classNames('auto-ai-scanner__symbol-option', {
                                'auto-ai-scanner__symbol-option--selected': selectedSymbol === s.id,
                              })}
                              onClick={() => {
                                setSelectedSymbol(s.id);
                                setShowSymbolPicker(false);
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="auto-ai-scanner__label">Trade Type</label>
                <div className="auto-ai-scanner__trade-types">
                  {TRADE_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={classNames('auto-ai-scanner__trade-type-button', {
                        'auto-ai-scanner__trade-type-button--active': selectedTradeType === t.id,
                      })}
                      onClick={() => {
                        setSelectedTradeType(t.id);
                        setSelectedSignal(null);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="auto-ai-scanner__grid-2">
                {[
                  { label: 'Stake ($)', value: stake, setter: setStake },
                  { label: 'Martingale x', value: martingale, setter: setMartingale },
                  { label: 'Take Profit ($)', value: takeProfit, setter: setTakeProfit },
                  { label: 'Stop Loss (losses)', value: stopLoss, setter: setStopLoss },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="auto-ai-scanner__label">{label}</label>
                    <input
                      type="number"
                      value={value}
                      title={label}
                      placeholder={label}
                      onChange={(e) => setter(e.target.value)}
                      className="auto-ai-scanner__input"
                    />
                  </div>
                ))}
              </div>

              <div className="auto-ai-scanner__note-card">
                <div>
                  <div className="auto-ai-scanner__note-title">Multi-Market Scan</div>
                  <div className="auto-ai-scanner__note-text">Scan all synthetic markets</div>
                </div>
                <button
                  type="button"
                  title="Toggle multi-market scan"
                  className={classNames('auto-ai-scanner__toggle', {
                    'auto-ai-scanner__toggle--active': multiMarket,
                  })}
                  onClick={() => setMultiMarket((v) => !v)}
                >
                  <div className="auto-ai-scanner__toggle-knob" />
                </button>
              </div>

              <div className="auto-ai-scanner__note-card">
                <div>
                  <div className="auto-ai-scanner__note-title">Speed Mode</div>
                  <div className="auto-ai-scanner__note-text">Trade every tick generated on the bot builder</div>
                </div>
                <button
                  type="button"
                  className={classNames('auto-ai-scanner__toggle', {
                    'auto-ai-scanner__toggle--active': speedMode,
                  })}
                  onClick={() => setSpeedMode((v) => !v)}
                >
                  <div className="auto-ai-scanner__toggle-knob" />
                </button>
              </div>

              <div className="auto-ai-scanner__action-row">
                <button type="button" className="auto-ai-scanner__button--secondary" onClick={resetScan}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={classNames('auto-ai-scanner__button--primary', {
                    'auto-ai-scanner__button--disabled': !isConnected,
                  })}
                  disabled={!isConnected}
                  onClick={startScan}
                >
                  {isConnected ? 'Scan Markets' : 'Connecting...'}
                </button>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="auto-ai-scanner__loader-row">
              <div className="auto-ai-scanner__scan-card">
                <div className="auto-ai-scanner__scan-card-header">
                  <span>Synthetic Indices</span>
                  <span>{scanProgress}/{scanTarget}</span>
                </div>
                <div className="auto-ai-scanner__progress">
                  <div ref={progressRef} className="auto-ai-scanner__progress-value" />
                </div>
              </div>
              <div className="auto-ai-scanner__scan-info">Collecting 1000 ticks across 3 windows...</div>
            </div>
          )}

          {step === 'result' && (
            <div className="auto-ai-scanner__row">
              {selectedSignal && (
                <div className="auto-ai-scanner__result-card">
                  <div>
                    <div className="auto-ai-scanner__result-card-title">
                      <span className="auto-ai-scanner__result-card-icon">✓</span>
                      <span>Selected Signal</span>
                    </div>
                    <p className="auto-ai-scanner__signal-recommendation">{selectedSignal.recommendation}</p>
                  </div>
                  <span className="auto-ai-scanner__signal-pill auto-ai-scanner__signal-pill--label">
                    {selectedSignal.tradeDirection ?? selectedSignal.label}
                  </span>
                </div>
              )}

              <div>
                <div className="auto-ai-scanner__signal-header">
                  <span>Ranked Signals · {combinedSignals.length} found</span>
                  {mwa?.aligned && <span className="auto-ai-scanner__aligned-pill">⚡ All windows aligned</span>}
                </div>
                <div className="auto-ai-scanner__signal-list">
                  {combinedSignals.length > 0 ? (
                    combinedSignals.map((s, i) => (
                      <button
                        type="button"
                        key={`${s.type}-${s.tradeDirection}-${i}`}
                        className={classNames('auto-ai-scanner__signal-card', {
                          'auto-ai-scanner__signal-card--selected': selectedSignal === s,
                          'auto-ai-scanner__signal-card--aligned': s.windowsAligned,
                        })}
                        onClick={() => setSelectedSignal(s)}
                      >
                        <div className="auto-ai-scanner__signal-card-body">
                          <div
                            className={classNames('auto-ai-scanner__signal-rank', {
                              'auto-ai-scanner__rank-1': i === 0,
                              'auto-ai-scanner__rank-2': i === 1,
                              'auto-ai-scanner__rank-3': i === 2,
                              'auto-ai-scanner__rank-default': i > 2,
                            })}
                          >
                            {i + 1}
                          </div>
                          <div className="auto-ai-scanner__signal-info">
                            <div className="auto-ai-scanner__signal-title">
                              <span className="auto-ai-scanner__signal-label">{s.label}</span>
                              {s.tradeDirection && (
                                <span
                                  className={classNames('auto-ai-scanner__signal-pill', {
                                    'auto-ai-scanner__signal-pill--trade-now': s.status === 'TRADE NOW',
                                    'auto-ai-scanner__signal-pill--wait': s.status === 'WAIT',
                                    'auto-ai-scanner__signal-pill--label': s.status !== 'TRADE NOW' && s.status !== 'WAIT',
                                  })}
                                >
                                  {s.tradeDirection}
                                </span>
                              )}
                              {s.windowsAligned && <span className="auto-ai-scanner__aligned-pill">✓ ALIGNED</span>}
                              {s.window && <span className="auto-ai-scanner__signal-window">{s.window}T</span>}
                            </div>
                            <p className="auto-ai-scanner__signal-recommendation">{s.recommendation}</p>
                          </div>
                          <div className="auto-ai-scanner__signal-meta">
                            <span
                              className={classNames('auto-ai-scanner__signal-status', {
                                'auto-ai-scanner__signal-status--trade-now': s.status === 'TRADE NOW',
                                'auto-ai-scanner__signal-status--wait': s.status === 'WAIT',
                                'auto-ai-scanner__signal-status--default': s.status !== 'TRADE NOW' && s.status !== 'WAIT',
                              })}
                            >
                              {s.status}
                            </span>
                            <span className="auto-ai-scanner__signal-probability">{s.probability.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="auto-ai-scanner__signal-bar">
                          <SignalValue width={Math.min(s.probability, 100)} />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="auto-ai-scanner__empty-state">
                      <div className="auto-ai-scanner__empty-state-icon">⚠️</div>
                      <p className="auto-ai-scanner__empty-state-title">No signals detected yet</p>
                      <p className="auto-ai-scanner__empty-state-text">Collecting more ticks...</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="auto-ai-scanner__panel-footer">
                <button type="button" className="auto-ai-scanner__button--secondary" onClick={resetScan}>
                  New Scan
                </button>
                <button type="button" className="auto-ai-scanner__button--success" onClick={handleLoadBotInternal}>
                  ↓ Load Bot
                </button>
                <button type="button" className="auto-ai-scanner__button--primary" onClick={handleLoadAndRunInternal}>
                  ▶ Load & Run
                </button>
              </div>
            </div>
          )}

          {step === 'executing' && (
            <div className="auto-ai-scanner__executing-state">
              <div className="auto-ai-scanner__moving-circles">
                <div className="circle"></div>
                <div className="circle"></div>
                <div className="circle"></div>
              </div>
              <div className="auto-ai-scanner__executing-text">Waiting for entry signal...</div>
              <div className="auto-ai-scanner__executing-subtext">
                {selectedSignal?.label} • {selectedSignal?.tradeDirection}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {orbEl}
      {panel}
    </>
  );
}
