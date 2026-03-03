// Shim for react-dom in React Native environment.
// @clerk/clerk-react imports react-dom for web portal functionality
// which is not available (or needed) in React Native.
const { createElement } = require('react');

module.exports = {
  createPortal: (children) => children,
  flushSync: (fn) => fn(),
  render: () => {},
  unmountComponentAtNode: () => {},
  findDOMNode: () => null,
  createElement,
};
