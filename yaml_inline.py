#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

yaml = YAML()
yaml.preserve_quotes = True
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


def to_inline_dict(d):
    """只把 dict 压成 { }，不动 list"""
    if isinstance(d, dict):
        m = CommentedMap()
        for k, v in d.items():
            m[k] = to_inline_dict(v)
        m.fa.set_flow_style()  # 👈 只压 dict
        return m
    elif isinstance(d, list):
        # list 保持 block，但里面元素处理
        return CommentedSeq([to_inline_dict(i) for i in d])
    return d


def process_list_block(lst):
    """外层保持 - ，内部 dict inline"""
    new_list = CommentedSeq()
    for item in lst:
        if isinstance(item, dict):
            new_list.append(to_inline_dict(item))
        else:
            new_list.append(item)
    return new_list


def main():
    if len(sys.argv) < 3:
        print("用法: ymlc input.yaml output.yaml")
        return

    infile = sys.argv[1]
    outfile = sys.argv[2]

    with open(infile, "r", encoding="utf-8") as f:
        data = yaml.load(f)

    # 🎯 只处理这两个
    if "proxies" in data:
        data["proxies"] = process_list_block(data["proxies"])

    if "proxy-groups" in data:
        data["proxy-groups"] = process_list_block(data["proxy-groups"])

    with open(outfile, "w", encoding="utf-8") as f:
        yaml.dump(data, f)

    print("✅ 完成：元素 inline + 外层 block →", outfile)


if __name__ == "__main__":
    main()