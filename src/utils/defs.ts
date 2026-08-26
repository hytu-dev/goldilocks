export interface TrieNode {
  [key: string]: TrieNode | number[] | undefined;
  _?: number[];
}
