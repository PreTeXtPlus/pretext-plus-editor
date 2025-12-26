/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  TheoremLikeComponent,
  ProofComponent,
} from "../components/TheoremLike";
import { blockAttributes, generateInputRules } from "../utils";

const TheoremLikeElements = [
  "theorem",
  "lemma",
  "corollary",
  "proposition",
  "claim",
  "fact",
];

const TheoremLike = Extension.create({
  name: "theoremLike",

  addExtensions(): Extension[] {
    const array: ReturnType<typeof Node.create>[] = [];
    for (const element of TheoremLikeElements) {
      array.push(
        Node.create({
          name: element,
          content: "title? statement proof*",
          group: "block theoremLike",
          selectable: true,
          draggable: true,
          defining: false,
          parseHTML() {
            return [
              {
                tag: element,
              },
            ];
          },
          addAttributes() {
            return blockAttributes();
          },

          renderHTML({ HTMLAttributes }) {
            return [
              "article",
              mergeAttributes(
                { class: `${element} theorem-like`, ptxtag: element },
                HTMLAttributes // Include all attributes from the node
              ),
            ];
          },
          addNodeView() {
            return ReactNodeViewRenderer(TheoremLikeComponent);
          },
          addInputRules() {
            // cast `this` to any so TS accepts .type here
            return generateInputRules(element, (this as any).type);
          },
        })
      );
    }

    // Add proof node
    array.push(
      Node.create({
        name: "proof",
        content: "title? BasicBlock+",
        group: "block",
        selectable: true,
        draggable: true,
        parseHTML() {
          return [{ tag: "proof" }];
        },
        renderHTML({ HTMLAttributes }) {
          return [
            "article",
            mergeAttributes(
              { class: "proof", ptxtag: "proof" },
              HTMLAttributes // Include all attributes from the node
            ),
            0,
          ];
        },
        addNodeView() {
          return ReactNodeViewRenderer(ProofComponent);
        },
        addInputRules() {
          return generateInputRules("proof", (this as any).type);
        },
      })
    );

    return array as Extension[];
  },
});

export default TheoremLike;

// return ['h4', {class: "heading"}, ['span', {class: "type"}, "Definition"], ['span', {class: "space"}, " " ], ['span', {class: "codenumber"}, "xx.yy"], ['span', {class: "period"}, "."], ['span', {class: "space"}, " "], ['span', {class: "title"}, 0]]
