export type FigureLanguage = 'ko' | 'en';
export type TcpScenario = 'normal' | 'loss';
export const TCP_TIME = {
  send: 600, lost: 1050, received: 1400, ack: 1650, confirmed: 2450,
  timeout: 3200, retried: 4000, retryAck: 4250, recovered: 5050, loop: 8050,
} as const;
export type TcpPhase = 'ready' | 'sending' | 'waiting' | 'retransmitting' | 'received' | 'acknowledging' | 'complete';
export const progressAt = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)));

export function tcpStateAt(time: number, scenario: TcpScenario) {
  const loss = scenario === 'loss';
  const completeAt = loss ? TCP_TIME.recovered : TCP_TIME.confirmed;
  const receivedAt = loss ? TCP_TIME.retried : TCP_TIME.received;
  const ackAt = loss ? TCP_TIME.retryAck : TCP_TIME.ack;
  let phase: TcpPhase;
  if (time < TCP_TIME.send) phase = 'ready';
  else if (loss && time < TCP_TIME.lost) phase = 'sending';
  else if (loss && time < TCP_TIME.timeout) phase = 'waiting';
  else if (time < receivedAt) phase = loss ? 'retransmitting' : 'sending';
  else if (time < ackAt) phase = 'received';
  else if (time < completeAt) phase = 'acknowledging';
  else phase = 'complete';
  return {
    phase,
    timer: time < TCP_TIME.send ? 'idle' : time >= completeAt ? 'stopped' : loss && time >= TCP_TIME.timeout ? 'restarted' : 'running',
    nextByte: time >= receivedAt ? 1100 : 1000,
    acknowledged: time >= completeAt,
    lost: loss && time >= TCP_TIME.lost,
    originalProgress: progressAt(time, TCP_TIME.send, loss ? TCP_TIME.lost : TCP_TIME.received),
    retryProgress: loss ? progressAt(time, TCP_TIME.timeout, TCP_TIME.retried) : 0,
    ackProgress: progressAt(time, ackAt, completeAt),
  };
}

export const tcpLabels = {
  ko: { title: '정상 전송과 재전송', normal: '정상 전송', loss: '손실 후 재전송', sender: '송신 측', receiver: '수신 측', time: '시간 ↓', bytes: '100바이트', retry: '재전송', lost: '손실', wait: 'ACK 대기', timeout: 'RTO 만료', complete: '전송 완료', caption: '설명용 시간축 · 손실 예제는 후속 데이터 없음', normalAlt: 'SEQ 1000부터 100바이트가 수신 측에 도착하고 ACK 1100이 송신 측에 돌아오면 전송이 완료됩니다.', lossAlt: '첫 데이터가 손실되어 ACK가 오지 않습니다. RTO 만료 후 같은 SEQ 1000을 재전송하고 ACK 1100이 도착하면 재전송 타이머가 정지합니다.' },
  en: { title: 'Normal delivery and retransmission', normal: 'Normal delivery', loss: 'Recovery after loss', sender: 'Sender', receiver: 'Receiver', time: 'Time ↓', bytes: '100 bytes', retry: 'retry', lost: 'Lost', wait: 'Await ACK', timeout: 'RTO expired', complete: 'Acknowledged', caption: 'Illustrative timeline · No later data in the loss example', normalAlt: '100 bytes starting at SEQ 1000 arrive at the receiver. ACK 1100 returns to the sender and completes the transfer.', lossAlt: 'The first segment is lost, so no ACK returns. When RTO expires, the sender retransmits SEQ 1000. ACK 1100 then arrives and stops the retransmission timer.' },
};
