import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { emit } from '../lib/events';
import { isHealthResponse } from '../lib/health';
import { Card, CardHeader, CardBody, Heading, Flex, Spacer, Badge, HStack, Skeleton, SkeletonText, Code, Alert, AlertIcon, Text, Button } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';

interface HealthCheckCardProps {
  path?: string;               // health endpoint, default '/actuator/health'
  intervalMs?: number;         // auto refresh interval
  minSkeletonMs?: number;      // minimum time skeleton remains
  onStatusChange?: (status: string) => void; // optional callback
  failureThreshold?: number;   // consecutive failures before auto-pausing
}

type HealthState = 'idle' | 'checking' | 'ok' | 'error';

export function HealthCheckCard({
  path = '/actuator/health',
  intervalMs,
  minSkeletonMs = 450,
  onStatusChange,
  failureThreshold = 3,
}: HealthCheckCardProps) {
  const envInterval = (() => {
    if (intervalMs) return intervalMs;
    const raw = import.meta.env.VITE_HEALTH_REFRESH_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 1000 ? n : 30000;
  })();
  const [status, setStatus] = useState<HealthState>('idle');
  // Track latest status in a ref so the polling callback doesn't re-subscribe every status change
  const statusRef = useRef<HealthState>('idle');
  useEffect(() => { statusRef.current = status; }, [status]);
  const [message, setMessage] = useState('');
  const [lastChecked, setLastChecked] = useState<number | undefined>();
  const checkStartRef = useRef<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalIdRef = useRef<number | null>(null);

  const runHealthCheck = useCallback(async () => {
    if (paused) return; // prevent background checks while paused
    setStatus(prev => (prev === 'idle' ? prev : 'checking'));
    checkStartRef.current = Date.now();
    try {
      const data = await api<unknown>(path);
      setStatus('ok');
      if (isHealthResponse(data) && typeof data.status === 'string' && data.status.length > 0) {
        setMessage(`status: ${data.status}`);
      } else {
        setMessage('Backend responded ✔');
      }
      setConsecutiveFailures(0);
      emit('health:success');
    } catch (e) {
      const err = e instanceof Error ? e : undefined;
      setStatus('error');
      setMessage(err?.message ?? 'Failed to reach backend');
      emit('health:fail', { error: (e as Error | undefined)?.message });
      setConsecutiveFailures(prev => {
        const next = prev + 1;
        if (next >= failureThreshold) {
          setPaused(true);
          emit('health:pause', { failures: next });
        }
        return next;
      });
    } finally {
      const end = Date.now();
      const elapsed = checkStartRef.current ? end - checkStartRef.current : 0;
      const delay = statusRef.current === 'checking' && elapsed < minSkeletonMs ? minSkeletonMs - elapsed : 0;
      setTimeout(() => setLastChecked(Date.now()), delay);
    }
  }, [path, minSkeletonMs, paused, failureThreshold]);

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  useEffect(() => {
    // Run once on mount then on the interval; pause disables interval
    let cancelled = false;
    (async () => { if (!cancelled) await runHealthCheck(); })();
    if (!paused) {
      const id = window.setInterval(() => { if (!cancelled) runHealthCheck(); }, envInterval);
      intervalIdRef.current = id;
    }
    return () => {
      cancelled = true;
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [envInterval, runHealthCheck, paused]);

  const handleResume = useCallback(async () => {
    setPaused(false);
    setConsecutiveFailures(0);
    emit('health:resume');
    await runHealthCheck();
  }, [runHealthCheck]);

  return (
  <Card data-testid='health-card'>
      <CardHeader py={3}>
        <Flex align='center' gap={3}>
          <Heading as='h2' size='sm'>Backend Health</Heading>
          <Spacer />
          {status === 'ok' && <Badge colorScheme='green'>OK</Badge>}
          {status === 'idle' && <Badge colorScheme='gray'>Checking</Badge>}
          {status === 'error' && <Badge colorScheme='red'>Error</Badge>}
        </Flex>
      </CardHeader>
      <CardBody pt={0}>
        <AnimatePresence mode='wait'>
          <motion.div
            key={status + message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {status === 'idle' && <Alert status='info' variant='subtle' size='sm'><AlertIcon />Checking…</Alert>}
            {status === 'checking' && (
              <HStack spacing={4} align='flex-start'>
                <Skeleton height='20px' width='72px' rounded='md' />
                <SkeletonText noOfLines={1} skeletonHeight='4' width='140px' />
              </HStack>
            )}
            {status === 'ok' && (
              <HStack spacing={3} fontSize='sm' align='flex-start'>
                <Badge colorScheme='green'>Healthy</Badge>
                <Code fontSize='xs'>{message}</Code>
              </HStack>
            )}
            {status === 'error' && !paused && (
              <Alert status='error' variant='subtle'>
                <AlertIcon /> <span>Error — <Code fontSize='xs'>{message}</Code></span>
              </Alert>
            )}
            {paused && (
              <Alert status='warning' variant='subtle' data-testid='health-paused'>
                <AlertIcon />
                <Flex align='center' gap={2} wrap='wrap'>
                  <Text>Paused after {consecutiveFailures} consecutive failures.</Text>
                  <Button size='xs' onClick={handleResume} data-testid='resume-btn'>Resume</Button>
                </Flex>
              </Alert>
            )}
          </motion.div>
        </AnimatePresence>
        <HStack justify='space-between' pt={3} fontSize='xs' opacity={0.75} flexWrap='wrap'>
          <Text>{lastChecked ? `Last check: ${new Date(lastChecked).toLocaleTimeString()}` : 'Awaiting first result…'}</Text>
          <Button size='xs' variant='outline' onClick={runHealthCheck} isDisabled={status==='idle' || paused}>Refresh now</Button>
        </HStack>
        <Text mt={2} fontSize='xs' opacity={0.6}>
          If this fails in dev, ensure the backend is running and CORS allows <Code fontSize='xs'>http://localhost:5173</Code>. If you use Actuator defaults, switch the fetch path to <Code fontSize='xs'>/actuator/health</Code>.
        </Text>
      </CardBody>
    </Card>
  );
}

export default HealthCheckCard;