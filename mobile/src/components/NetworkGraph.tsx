import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

interface NetworkGraphProps {
  /** Ordered path of people names, e.g. ["Ian Macintosh", "Kate Miller", "Jane Thompson", "Sarah Chen"] */
  path: string[];
}

// ── Colors ──────────────────────────────────────────────────────────
const COLORS = {
  you: '#7B61FF',
  youGlow: 'rgba(123, 97, 255, 0.4)',
  target: '#4A90D9',
  targetGlow: 'rgba(74, 144, 217, 0.4)',
  intermediate: '#2A2F54',
  intermediateRing: 'rgba(123, 97, 255, 0.25)',
  intermediateGlow: 'rgba(42, 47, 84, 0.3)',
  edgePath: 'rgba(123, 97, 255, 0.55)',
  edgeReturn: 'rgba(74, 144, 217, 0.35)',
  text: '#E6E6E6',
  label: '#8892B0',
};

const NODE_SIZE = 50;
const GRAPH_HEIGHT = 220;

// ── Position nodes in a CIRCLE so the connection forms a full loop ──
// The path goes: You → person1 → person2 → ... → Target
// We close the loop visually: Target connects back to You
function getCircularPositions(count: number, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  // Ellipse radii — wider than tall
  const rx = width * 0.36;
  const ry = height * 0.32;

  // Start from the left (π) and go clockwise
  // Distribute nodes evenly around the circle
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Start at π (left side), go clockwise (subtract angle)
    const angle = Math.PI - (i / count) * 2 * Math.PI;
    positions.push({
      x: centerX + rx * Math.cos(angle),
      y: centerY - ry * Math.sin(angle),
    });
  }
  return positions;
}

// ── Edge line between two points ────────────────────────────────────
const EdgeLine: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  color: string;
  thickness: number;
  pulseAnim: Animated.Value;
  isReturn?: boolean;
  dashed?: boolean;
}> = ({ x1, y1, x2, y2, color, thickness, pulseAnim, isReturn, dashed }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const animOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: isReturn ? [0.2, 0.5, 0.2] : [0.4, 0.85, 0.4],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: length,
        height: thickness,
        left: midX - length / 2,
        top: midY - thickness / 2,
        backgroundColor: color,
        borderRadius: thickness / 2,
        transform: [{ rotate: `${angle}deg` }],
        opacity: animOpacity,
      }}
    />
  );
};

// ── Arrowhead on an edge ────────────────────────────────────────────
const ArrowHead: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  color: string;
  pulseAnim: Animated.Value;
}> = ({ x1, y1, x2, y2, color, pulseAnim }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  // Place arrow 70% along the edge
  const t = 0.65;
  const ax = x1 + dx * t;
  const ay = y1 + dy * t;

  const animOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: ax - 5,
        top: ay - 5,
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        transform: [{ rotate: `${angle + 90}deg` }],
        opacity: animOpacity,
      }}
    />
  );
};

// ── Single node ─────────────────────────────────────────────────────
const GraphNode: React.FC<{
  name: string;
  label: string;
  x: number;
  y: number;
  nodeColor: string;
  glowColor: string;
  isEndpoint: boolean;
  pulseAnim: Animated.Value;
  fadeAnim: Animated.Value;
}> = ({ name, label, x, y, nodeColor, glowColor, isEndpoint, pulseAnim, fadeAnim }) => {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const glowScale = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: isEndpoint ? [1, 1.15, 1] : [1, 1.06, 1],
  });

  return (
    <Animated.View
      style={[
        styles.nodeOuter,
        {
          left: x - NODE_SIZE / 2,
          top: y - NODE_SIZE / 2,
          opacity: fadeAnim,
          transform: [{ scale: fadeAnim }],
        },
      ]}
    >
      {/* Glow */}
      <Animated.View
        style={[
          styles.nodeGlow,
          { backgroundColor: glowColor, transform: [{ scale: glowScale }] },
        ]}
      />
      {/* Circle */}
      <View
        style={[
          styles.nodeCircle,
          { backgroundColor: nodeColor },
          isEndpoint && styles.nodeEndpoint,
        ]}
      >
        <Text style={[styles.nodeInitials, isEndpoint && { fontWeight: '800', fontSize: 16 }]}>
          {initials}
        </Text>
      </View>
      {/* Name label */}
      <Text style={styles.nodeLabel} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
};

// ── Ambient background dots ─────────────────────────────────────────
const AMBIENT = [
  { x: 0.04, y: 0.08, s: 4 }, { x: 0.96, y: 0.12, s: 3 },
  { x: 0.12, y: 0.92, s: 5 }, { x: 0.88, y: 0.90, s: 3 },
  { x: 0.50, y: 0.02, s: 4 }, { x: 0.50, y: 0.98, s: 3 },
  { x: 0.02, y: 0.50, s: 3 }, { x: 0.98, y: 0.50, s: 4 },
];

// ── Main graph ──────────────────────────────────────────────────────
const NetworkGraph: React.FC<NetworkGraphProps> = ({ path }) => {
  const containerWidth = Dimensions.get('window').width - 80; // parent padding
  const positions = getCircularPositions(path.length, containerWidth, GRAPH_HEIGHT);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const nodeAnims = useRef(path.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Continuous pulse
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ).start();

    // Staggered entrance for nodes
    Animated.stagger(
      120,
      nodeAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.back(1.3)),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, []);

  return (
    <View style={[styles.graphContainer, { height: GRAPH_HEIGHT + 30 }]}>
      {/* Ambient background dots */}
      {AMBIENT.map((a, i) => (
        <View
          key={`a-${i}`}
          style={{
            position: 'absolute',
            left: a.x * containerWidth - a.s / 2,
            top: a.y * GRAPH_HEIGHT - a.s / 2,
            width: a.s,
            height: a.s,
            borderRadius: a.s / 2,
            backgroundColor: 'rgba(123, 97, 255, 0.12)',
          }}
        />
      ))}

      {/* ── Edges along the path (forward direction) ── */}
      {positions.slice(0, -1).map((pos, i) => (
        <EdgeLine
          key={`edge-${i}`}
          x1={pos.x}
          y1={pos.y}
          x2={positions[i + 1].x}
          y2={positions[i + 1].y}
          color={COLORS.edgePath}
          thickness={2.5}
          pulseAnim={pulseAnim}
        />
      ))}

      {/* ── Arrows along forward path ── */}
      {positions.slice(0, -1).map((pos, i) => (
        <ArrowHead
          key={`arrow-${i}`}
          x1={pos.x}
          y1={pos.y}
          x2={positions[i + 1].x}
          y2={positions[i + 1].y}
          color={COLORS.you}
          pulseAnim={pulseAnim}
        />
      ))}

      {/* ── Closing edge: Target → You (dashed/lighter = "direct connection") ── */}
      {path.length >= 3 && (
        <>
          <EdgeLine
            x1={positions[positions.length - 1].x}
            y1={positions[positions.length - 1].y}
            x2={positions[0].x}
            y2={positions[0].y}
            color={COLORS.edgeReturn}
            thickness={2}
            pulseAnim={pulseAnim}
            isReturn
          />
          <ArrowHead
            x1={positions[positions.length - 1].x}
            y1={positions[positions.length - 1].y}
            x2={positions[0].x}
            y2={positions[0].y}
            color={COLORS.target}
            pulseAnim={pulseAnim}
          />
        </>
      )}

      {/* ── Nodes ── */}
      {path.map((name, i) => {
        const isFirst = i === 0;
        const isLast = i === path.length - 1;
        const nodeColor = isFirst ? COLORS.you : isLast ? COLORS.target : COLORS.intermediate;
        const glowColor = isFirst ? COLORS.youGlow : isLast ? COLORS.targetGlow : COLORS.intermediateGlow;

        return (
          <GraphNode
            key={`node-${i}`}
            name={name}
            label={isFirst ? 'You' : name}
            x={positions[i].x}
            y={positions[i].y}
            nodeColor={nodeColor}
            glowColor={glowColor}
            isEndpoint={isFirst || isLast}
            pulseAnim={pulseAnim}
            fadeAnim={nodeAnims[i]}
          />
        );
      })}

      {/* "Direct" label on the return edge */}
      {path.length >= 3 && (
        <View style={styles.directLabel}>
          <Text style={styles.directLabelText}>direct</Text>
        </View>
      )}
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  graphContainer: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },

  // Nodes
  nodeOuter: {
    position: 'absolute',
    width: NODE_SIZE,
    alignItems: 'center',
    zIndex: 10,
  },
  nodeGlow: {
    position: 'absolute',
    width: NODE_SIZE + 18,
    height: NODE_SIZE + 18,
    borderRadius: (NODE_SIZE + 18) / 2,
    left: -9,
    top: -9,
  },
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  nodeEndpoint: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nodeInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  nodeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.label,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 80,
  },

  // "direct" badge
  directLabel: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -22,
    backgroundColor: 'rgba(74, 144, 217, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 217, 0.25)',
    zIndex: 5,
  },
  directLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.target,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default NetworkGraph;
