import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';

// Get device dimensions for positioning nodes across the entire screen
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Configuration constants for the network animation
const NODE_COUNT = 30;                    // Total number of floating nodes
const EDGE_OPACITY = 0.22;               // Opacity of connection lines between nodes
const NODE_OPACITY = 0.35;               // Base opacity of nodes (they pulse brighter)
const MAX_EDGE_DISTANCE = 150;           // Maximum distance for nodes to be connected by edges
const ANIMATION_DURATION_MIN = 5000;     // Minimum animation cycle time in milliseconds
const ANIMATION_DURATION_MAX = 12000;    // Maximum animation cycle time in milliseconds

// Data structure representing each animated node
interface NodeData {
  id: number;                  // Unique identifier
  startX: number;              // Initial X position
  startY: number;              // Initial Y position
  endX: number;                // Target X position (for drift animation)
  endY: number;                // Target Y position (for drift animation)
  radius: number;              // Node size radius
  animX: Animated.Value;       // Animation value for X movement (0 to 1)
  animY: Animated.Value;       // Animation value for Y movement (0 to 1)
  pulseAnim: Animated.Value;   // Animation value for pulsing effect (0 to 1)
}

// Utility function to generate random numbers within a range
function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Factory function to create a single node with random properties
function createNode(id: number): NodeData {
  const margin = 30; // Keep nodes away from screen edges
  
  // Generate random starting position within screen bounds
  const startX = randomBetween(margin, SCREEN_W - margin);
  const startY = randomBetween(margin, SCREEN_H - margin);
  
  // Drift range: nodes move within ±80px of their start position for subtle movement
  const driftX = randomBetween(-80, 80);
  const driftY = randomBetween(-80, 80);
  
  // Calculate end position, clamped to screen bounds
  const endX = Math.max(margin, Math.min(SCREEN_W - margin, startX + driftX));
  const endY = Math.max(margin, Math.min(SCREEN_H - margin, startY + driftY));
  
  // Random node size - larger nodes are more visually prominent
  const radius = randomBetween(3, 10);

  return {
    id,
    startX,
    startY,
    endX,
    endY,
    radius,
    // Initialize animated values at 0 (will animate to 1 and back)
    animX: new Animated.Value(0),
    animY: new Animated.Value(0),
    pulseAnim: new Animated.Value(0),
  };
}

// Function to start the infinite animation loop for a single node
function animateNode(node: NodeData) {
  // Random duration for organic, non-synchronized movement
  const duration = randomBetween(ANIMATION_DURATION_MIN, ANIMATION_DURATION_MAX);

  // X-axis movement: 0 → 1 → 0 (start → end → start positions)
  const moveX = Animated.sequence([
    Animated.timing(node.animX, {
      toValue: 1,
      duration,
      useNativeDriver: true, // Better performance on UI thread
    }),
    Animated.timing(node.animX, {
      toValue: 0,
      duration,
      useNativeDriver: true,
    }),
  ]);

  // Y-axis movement: slightly different timing for more organic motion
  const moveY = Animated.sequence([
    Animated.timing(node.animY, {
      toValue: 1,
      duration: duration * 1.1, // 10% longer than X animation
      useNativeDriver: true,
    }),
    Animated.timing(node.animY, {
      toValue: 0,
      duration: duration * 1.1,
      useNativeDriver: true,
    }),
  ]);

  // Pulsing effect: nodes brighten and scale up/down
  const pulse = Animated.sequence([
    Animated.timing(node.pulseAnim, {
      toValue: 1,
      duration: duration * 0.8, // Faster pulse than movement
      useNativeDriver: true,
    }),
    Animated.timing(node.pulseAnim, {
      toValue: 0,
      duration: duration * 0.8,
      useNativeDriver: true,
    }),
  ]);

  // Run all three animations in parallel, then recursively restart
  Animated.parallel([moveX, moveY, pulse]).start(() => animateNode(node));
}

// Pre-compute which nodes should be connected by edges based on distance
// This is done once for performance - we don't recalculate during animation
function computeEdges(nodes: NodeData[]): [number, number][] {
  const edges: [number, number][] = [];
  
  // Check every pair of nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      // Calculate distance between node centers
      const dx = nodes[i].startX - nodes[j].startX;
      const dy = nodes[i].startY - nodes[j].startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Only connect nodes within the maximum edge distance
      if (dist < MAX_EDGE_DISTANCE) {
        edges.push([i, j]); // Store as [nodeIndex1, nodeIndex2]
      }
    }
  }
  return edges;
}

const NetworkBackground: React.FC = () => {
  // Create all nodes once and store in ref to persist across re-renders
  // Using useRef prevents nodes from being recreated on every render
  const nodes = useRef<NodeData[]>(
    Array.from({ length: NODE_COUNT }, (_, i) => createNode(i)),
  ).current;

  // Pre-compute edges once for performance - useMemo prevents recalculation
  // unless the nodes array reference changes (which it won't)
  const edges = useMemo(() => computeEdges(nodes), []);

  useEffect(() => {
    // Stagger animation start times so nodes don't all move in perfect sync
    // This creates a more natural, organic feeling to the movement
    nodes.forEach((node, i) => {
      setTimeout(() => animateNode(node), i * 300); // 300ms delay between each node
    });
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Render connection lines between nearby nodes */}
      {edges.map(([i, j]) => {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        // Calculate line position and rotation
        const midX = (nodeA.startX + nodeB.startX) / 2;  // Center point X
        const midY = (nodeA.startY + nodeB.startY) / 2;  // Center point Y
        const dx = nodeB.startX - nodeA.startX;           // X distance
        const dy = nodeB.startY - nodeA.startY;           // Y distance
        const length = Math.sqrt(dx * dx + dy * dy);      // Line length
        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // Rotation angle in degrees

        return (
          <View
            key={`edge-${i}-${j}`}
            style={[
              styles.edge,
              {
                width: length,                    // Line stretches between nodes
                left: midX - length / 2,         // Center the line horizontally
                top: midY,                       // Position line at midpoint
                transform: [{ rotate: `${angle}deg` }], // Rotate to connect nodes
              },
            ]}
          />
        );
      })}

      {/* Render main network nodes */}
      {nodes.map((node) => {
        // Convert animation values (0-1) to actual pixel movement
        const translateX = node.animX.interpolate({
          inputRange: [0, 1],
          outputRange: [0, node.endX - node.startX], // Move from start to end position
        });
        const translateY = node.animY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, node.endY - node.startY],
        });
        
        // Pulsing effects: nodes scale up and brighten
        const scale = node.pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.8], // Scale from normal to 1.8x size
        });
        const opacity = node.pulseAnim.interpolate({
          inputRange: [0, 0.5, 1],                                    // Pulse peaks at 0.5
          outputRange: [NODE_OPACITY, NODE_OPACITY * 2, NODE_OPACITY], // Double brightness at peak
        });

        return (
          <Animated.View
            key={`node-${node.id}`}
            style={[
              styles.node,
              {
                width: node.radius * 2,            // Diameter = radius * 2
                height: node.radius * 2,
                borderRadius: node.radius,         // Make it circular
                left: node.startX - node.radius,   // Center at start position
                top: node.startY - node.radius,
                opacity,                           // Animated opacity
                transform: [{ translateX }, { translateY }, { scale }], // All transforms
              },
            ]}
          />
        );
      })}

      {/* Render glow halos around some nodes for depth and visual interest */}
      {nodes.slice(0, 10).map((node) => {
        // Same movement as main nodes
        const translateX = node.animX.interpolate({
          inputRange: [0, 1],
          outputRange: [0, node.endX - node.startX],
        });
        const translateY = node.animY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, node.endY - node.startY],
        });
        
        // Glow intensity pulses independently
        const glowOpacity = node.pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.08, 0.18], // Dimmer than main nodes, for subtle effect
        });

        return (
          <Animated.View
            key={`glow-${node.id}`}
            style={[
              styles.glowNode,
              {
                width: node.radius * 12,          // Much larger than main node
                height: node.radius * 12,
                borderRadius: node.radius * 6,   // Keep circular
                left: node.startX - node.radius * 6,  // Center the larger glow
                top: node.startY - node.radius * 6,
                opacity: glowOpacity,
                transform: [{ translateX }, { translateY }], // No scaling for glow
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Fill entire screen behind other content
    overflow: 'hidden',               // Clip nodes that drift near edges
  },
  node: {
    position: 'absolute',             // Absolute positioning for precise placement
    backgroundColor: '#A0AACF',       // Bright silver-blue color for visibility
  },
  glowNode: {
    position: 'absolute',
    backgroundColor: '#5B8AC9',       // Slightly more blue for glow effect
  },
  edge: {
    position: 'absolute',
    height: 1,                        // 1px thick connection lines
    backgroundColor: '#8892B0',       // Muted gray color for subtle connections
    opacity: EDGE_OPACITY,            // Global opacity setting for all edges
  },
});

// Memoize component to prevent unnecessary re-renders
// The animation runs entirely on the native thread via useNativeDriver
export default React.memo(NetworkBackground);
