"use client";

import { useEffect, useState, useMemo } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from("deals")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      setDeals((data || []) as Deal[]);
      setLoading(false);
    }
    load();
  }, []);

  const sports = useMemo(() => [...new Set(deals.map((d) => d.athlete_sport).filter(Boolean))].sort(), [deals]);
  const colleges = useMemo(() => [...new Set(deals.map((d) => d.athlete_school).filter(Boolean))].sort(), [deals]);
  const brands = useMemo(() => [...new Set(deals.map((d) => d.brand_name).filter(Boolean))].sort(), [deals]);
  const types = useMemo(() => {
    const all = new Set<string>();
    deals.forEach((d) => {
      if (d.deal_type) d.deal_type.split(",").map((t) => t.trim()).forEach((t) => all.add(t));
    });
    return [...all].sort();
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (sportFilter && d.athlete_sport !== sportFilter) return false;
      if (collegeFilter && d.athlete_school !== collegeFilter) return false;
      if (brandFilter && d.brand_name !== brandFilter) return false;
      if (typeFilter && (!d.deal_type || !d.deal_type.includes(typeFilter))) return false;
      return true;
    });
  }, [deals, sportFilter, collegeFilter, brandFilter, typeFilter]);

  const hasFilters = sportFilter || collegeFilter || brandFilter || typeFilter;

  function resetFilters() {
    setSportFilter("");
    setCollegeFilter("");
    setBrandFilter("");
    setTypeFilter("");
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-20 text-center">
          <img
            src="/postgame-logo-white.png"
            alt="Postgame"
            className="h-10 md:h-14 object-contain mx-auto mb-5 md:mb-6"
          />
          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: "#D73F09" }}
          >
            NIL DEAL TRACKER
          </h1>
          <p
            className="text-gray-400 max-w-3xl mx-auto"
            style={{ fontSize: "clamp(14px, 2vw, 24px)", lineHeight: 1.4 }}
          >
            Postgame is known for our large scale NIL campaigns featuring thousands of college athletes
            with a wide range of social following across all schools and sports. Below is a sample list
            of Headliner Athletes that we&apos;ve worked with over the years. Use the filters below to
            search by sport, school, brand, or campaign type.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 md:py-6">
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <span
              className="font-bold uppercase tracking-wider text-gray-500 mr-1"
              style={{ fontSize: "clamp(11px, 1.2vw, 14px)" }}
            >
              Filter by
            </span>
            <FilterSelect label="Sport" value={sportFilter} onChange={setSportFilter} options={sports} />
            <FilterSelect label="College" value={collegeFilter} onChange={setCollegeFilter} options={colleges} />
            <FilterSelect label="Brand" value={brandFilter} onChange={setBrandFilter} options={brands} />
            <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={types} />
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="font-bold uppercase tracking-wider border border-[#D73F09] text-[#D73F09] rounded hover:bg-[#D73F09] hover:text-white transition-colors"
                style={{ fontSize: "clamp(11px, 1.2vw, 14px)", padding: "10px 20px" }}
              >
                Reset
              </button>
            )}
          </div>
          {hasFilters && (
            <p className="text-gray-500 mt-3" style={{ fontSize: "clamp(11px, 1.2vw, 14px)" }}>
              Showing {filtered.length} of {deals.length} deals
            </p>
          )}
        </div>
      </div>

      {/* Deal Grid */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
        {loading ? (
          <div className="text-center py-20 text-gray-500" style={{ fontSize: "clamp(14px, 2vw, 24px)", lineHeight: 1.4 }}>
            Loading deals...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-6" style={{ fontSize: "clamp(14px, 2vw, 24px)", lineHeight: 1.4 }}>
              No deals match your filters.
            </p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="font-bold text-[#D73F09] hover:underline"
                style={{ fontSize: "clamp(14px, 2vw, 18px)" }}
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {filtered.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800">
        <div
          className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-10 text-center text-gray-600"
          style={{ fontSize: "clamp(11px, 1.5vw, 18px)", lineHeight: 1.2 }}
        >
          <p>&copy; {new Date().getFullYear()} Postgame. All rights reserved.</p>
          <p className="mt-2">
            To learn more about promoting your brand through college athletes, contact us at{" "}
            <a href="mailto:info@pstgm.com" className="text-[#D73F09] hover:underline">
              info@pstgm.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border rounded bg-black appearance-none cursor-pointer ${
        value
          ? "border-[#D73F09] text-[#D73F09]"
          : "border-gray-700 text-gray-400 hover:border-gray-500"
      }`}
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "clamp(11px, 1.2vw, 14px)",
        padding: "10px 36px 10px 16px",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
    >
      <option value="">{label}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="border border-gray-800 rounded-xl hover:border-gray-600 transition-all group overflow-hidden">
      {/* Deal Image */}
      {deal.image_url && (
        <div className="aspect-[4/5] overflow-hidden">
          <img
            src={deal.image_url}
            alt={deal.athlete_name || deal.brand_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}

      <div style={{ padding: "clamp(16px, 2.5vw, 24px)" }}>
      {/* Athlete Name = Header */}
      <h3
        className="font-bold tracking-tight"
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(18px, 2.5vw, 26px)",
          marginBottom: "4px",
        }}
      >
        {deal.athlete_name || "Team Campaign"}
      </h3>

      {/* Brand = Sub-header */}
      <p
        className="text-[#D73F09] font-bold"
        style={{ fontSize: "clamp(13px, 1.5vw, 18px)", marginBottom: "10px" }}
      >
        {deal.brand_name}
      </p>

      {/* School + Sport line */}
      {(deal.athlete_school || deal.athlete_sport) && (
        <p
          className="text-gray-400"
          style={{ fontSize: "clamp(12px, 1.3vw, 16px)", lineHeight: 1.4, marginBottom: "10px" }}
        >
          {[deal.athlete_school, deal.athlete_sport].filter(Boolean).join(" \u00B7 ")}
        </p>
      )}

      {/* Description */}
      {deal.description && (
        <p
          className="text-gray-500 line-clamp-2"
          style={{ fontSize: "clamp(12px, 1.3vw, 15px)", lineHeight: 1.4, marginBottom: "12px" }}
        >
          {deal.description}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap" style={{ gap: "6px", marginBottom: deal.date_announced ? "12px" : "0" }}>
        {deal.deal_type &&
          deal.deal_type.split(",").map((t) => (
            <span
              key={t.trim()}
              className="bg-white/5 border border-gray-800 rounded-full text-gray-400"
              style={{ fontSize: "clamp(10px, 1vw, 12px)", padding: "4px 10px" }}
            >
              {t.trim()}
            </span>
          ))}
      </div>

      {/* Date */}
      {deal.date_announced && (
        <p className="text-gray-600" style={{ fontSize: "clamp(10px, 1vw, 13px)" }}>
          {new Date(deal.date_announced + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
      </div>
    </div>
  );
}
