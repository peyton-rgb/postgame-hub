#!/bin/bash
# one round: up to N schools in parallel, each capped at 160s; finished schools are skipped next time
cd "$(dirname "$0")"; N=${2:-24}; list=$1; outdir=$3; prog=$4
todo=$(while read d; do [ -e "$outdir/$d.done" ] || echo "$d"; done < "$list" | head -$N)
for d in $todo; do ( timeout 160 python3 $prog "$d" "$outdir/$d.jsonl" > "$outdir/$d.log" 2>&1; echo $? > "$outdir/$d.done" ) & done; wait
echo "round done; finished $(ls $outdir/*.done 2>/dev/null | wc -l)/$(wc -l < $list), timed-out $(grep -l '^124$' $outdir/*.done 2>/dev/null | wc -l), athletes $(cat $outdir/*.jsonl 2>/dev/null | wc -l)"
