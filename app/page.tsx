"use client";

import { useState } from "react";

type Deal = {
  product_name: string;
  store_name: string;
  price: number | null;
  regular_price: number | null;
  size: string | null;
  unit_price: number | null;
  unit_price_per: string | null;
  on_sale: boolean | null;
  currency: string;
};

export default function Home() {
  const [postalCode, setPostalCode] = useState("");
  const [searchItem, setSearchItem] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllDeals, setShowAllDeals] = useState(false);

  async function findBestDeal() {
    if (!postalCode.trim() || !searchItem.trim()) {
      setMessage(
        "Please enter your postal code and what you are looking for."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setDeals([]);
    setShowAllDeals(false);

    try {
      const product = encodeURIComponent(searchItem.trim());

      const response = await fetch(
        "/api/vynn-test?product=" + product + "&province=ON"
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Vynn search error:", result);

        setMessage("There was a problem searching for deals.");

        setLoading(false);
        return;
      }

      const results = result.data?.results || [];

      const formattedDeals: Deal[] = results.map(
        (item: any) => ({
          product_name:
            item.product_name || "Product",

          store_name:
            item.banner?.value ||
            item.provider?.value ||
            "Store",

          price:
            item.price !== null &&
            item.price !== undefined
              ? Number(item.price)
              : null,

          regular_price:
            item.regular_price !== null &&
            item.regular_price !== undefined
              ? Number(item.regular_price)
              : null,

          size:
            item.size || null,

          unit_price:
            item.comparison_unit_price?.price !== null &&
            item.comparison_unit_price?.price !== undefined
              ? Number(
                  item.comparison_unit_price.price
                )
              : null,

          unit_price_per:
            item.comparison_unit_price?.per ||
            null,

          on_sale:
            item.on_sale ?? null,

          currency:
            item.currency || "CAD",
        })
      );

      setDeals(formattedDeals);

      if (formattedDeals.length === 0) {
        setMessage(
          `No matching deals were found in Ontario for "${searchItem}".`
        );
      }
    } catch (error) {
      console.error("Search failed:", error);

      setMessage(
        "Could not connect to the deal search."
      );
    }

    setLoading(false);
  }

  /*
   * Convert Vynn comparison prices to $/lb.
   *
   * 100g -> lb
   * kg -> lb
   *
   * IMPORTANT:
   * If Vynn does not tell us the unit,
   * we DO NOT guess.
   */
  function getPricePerPound(deal: Deal) {
    if (
      deal.unit_price === null ||
      !deal.unit_price_per
    ) {
      return null;
    }

    const unit = deal.unit_price_per
      .toLowerCase()
      .replace(/\s/g, "");

    if (unit === "100g") {
      return deal.unit_price * 4.53592;
    }

    if (unit === "kg") {
      return deal.unit_price / 2.20462;
    }

    if (unit === "lb") {
      return deal.unit_price;
    }

    return null;
  }

  /*
   * Calculate $/lb from the actual package size.
   *
   * Example:
   * $24.23 for 1 kg
   *
   * $24.23 / 2.20462 lb
   * = $10.99/lb
   */
  function getPackagePricePerPound(deal: Deal) {
    if (
      deal.price === null ||
      !deal.size
    ) {
      return null;
    }

    const sizeText = deal.size
      .toLowerCase()
      .replace(/,/g, "")
      .trim();

    const gramMatch =
      sizeText.match(/([\d.]+)\s*g\b/);

    if (gramMatch) {
      const grams = Number(gramMatch[1]);

      if (grams > 0) {
        return (
          deal.price /
          (grams / 453.592)
        );
      }
    }

    const kgMatch =
      sizeText.match(/([\d.]+)\s*kg\b/);

    if (kgMatch) {
      const kilograms = Number(kgMatch[1]);

      if (kilograms > 0) {
        return (
          deal.price /
          (kilograms * 2.20462)
        );
      }
    }

    return null;
  }

  /*
   * Get the safest available $/lb.
   *
   * First preference:
   * Vynn's confirmed comparison price.
   *
   * Second preference:
   * Calculate from actual package size.
   *
   * If neither is available:
   * return null.
   */
  function getDisplayPricePerPound(deal: Deal) {
    const comparisonPrice =
      getPricePerPound(deal);

    if (comparisonPrice !== null) {
      return comparisonPrice;
    }

    const packagePrice =
      getPackagePricePerPound(deal);

    if (packagePrice !== null) {
      return packagePrice;
    }

    return null;
  }

  /*
   * Display original metric size
   * PLUS converted pounds.
   *
   * Examples:
   *
   * 1 kg -> 1 kg (2.20 lb)
   * 2 kg -> 2 kg (4.41 lb)
   * 4.54 kg -> 4.54 kg (10.00 lb)
   * 498 g -> 498 g (1.10 lb)
   */
  function getDisplaySize(deal: Deal) {
    if (!deal.size) {
      return null;
    }

    const sizeText = deal.size
      .toLowerCase()
      .replace(/,/g, "")
      .trim();

    const gramMatch =
      sizeText.match(/([\d.]+)\s*g\b/);

    if (gramMatch) {
      const grams = Number(gramMatch[1]);

      if (grams > 0) {
        const pounds =
          grams / 453.592;

        return `${grams} g (${pounds.toFixed(2)} lb)`;
      }
    }

    const kgMatch =
      sizeText.match(/([\d.]+)\s*kg\b/);

    if (kgMatch) {
      const kilograms =
        Number(kgMatch[1]);

      if (kilograms > 0) {
        const pounds =
          kilograms * 2.20462;

        return `${kilograms} kg (${pounds.toFixed(2)} lb)`;
      }
    }

    return deal.size;
  }

  /*
   * Only deals with a confirmed/computable
   * $/lb are allowed into the Best Deals ranking.
   *
   * This is important for products such as
   * the previous Adonis $1.79 result.
   */
  const comparableDeals = deals
    .map((deal) => ({
      deal,
      pricePerPound:
        getDisplayPricePerPound(deal),
    }))
    .filter(
      (item) =>
        item.pricePerPound !== null &&
        Number.isFinite(item.pricePerPound)
    )
    .sort(
      (a, b) =>
        (a.pricePerPound ?? Infinity) -
        (b.pricePerPound ?? Infinity)
    );

  const bestDeals =
    comparableDeals.slice(0, 3);

  return (
    <main className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-green-700 text-white">
        <div className="mx-auto max-w-6xl px-6 py-5">

          <h1 className="text-3xl font-bold">
            SaveEveryDayDeals
          </h1>

          <p className="mt-1 text-green-100">
            Find today&apos;s deals. Save every day.
          </p>

        </div>
      </header>


      {/* SEARCH */}
      <section className="mx-auto max-w-4xl px-6 py-12 text-center">

        <h2 className="text-4xl font-bold text-gray-900">
          Find the best deal near you
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Tell us where you are and what you are looking for.
        </p>


        <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">

          {/* POSTAL CODE */}
          <div className="text-left">

            <label className="mb-2 block font-semibold text-gray-800">
              Your postal code
            </label>

            <input
              type="text"
              value={postalCode}
              onChange={(event) =>
                setPostalCode(event.target.value)
              }
              placeholder="Example: L8P 1A1"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-600"
            />

          </div>


          {/* PRODUCT */}
          <div className="text-left">

            <label className="mb-2 block font-semibold text-gray-800">
              What are you looking for?
            </label>

            <input
              type="text"
              value={searchItem}
              onChange={(event) =>
                setSearchItem(event.target.value)
              }
              placeholder="Example: Chicken breast"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-600"
            />

          </div>

        </div>


        {/* SEARCH BUTTON */}
        <button
          onClick={findBestDeal}
          disabled={loading}
          className="mt-6 rounded-lg bg-green-700 px-8 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {loading
            ? "Searching..."
            : "Find My Best Deal"}
        </button>


        {/* MESSAGE */}
        {message && (
          <p className="mt-4 text-sm font-semibold text-gray-700">
            {message}
          </p>
        )}

      </section>


      {/* RESULTS */}
      {deals.length > 0 && (

        <section className="mx-auto max-w-5xl px-6 pb-12">

          {/* BEST DEALS SUMMARY */}
          {bestDeals.length > 0 && (

            <div className="rounded-2xl border-2 border-green-300 bg-white p-8 shadow-md">

              <div className="text-center">

                <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                  🏆 Best Deals Here
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  Best {searchItem} Deals
                </h2>

                <p className="mt-2 text-gray-600">
                  Lowest comparable price per pound
                </p>

              </div>


              {/* TOP DEALS */}
              <div className="mt-6 space-y-4">

                {bestDeals.map(
                  (
                    item,
                    index
                  ) => {

                    const deal =
                      item.deal;

                    const price =
                      item.pricePerPound!;

                    return (

                      <div
                        key={
                          deal.store_name +
                          "-" +
                          deal.product_name +
                          "-" +
                          index
                        }
                        className="flex items-center justify-between rounded-xl bg-green-50 p-5"
                      >

                        <div className="flex items-center gap-4">

                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 font-bold text-white">
                            {index + 1}
                          </div>

                          <div>

                            <p className="font-bold text-gray-900">
                              {deal.store_name}
                            </p>

                            <p className="text-sm text-gray-600">
                              {deal.product_name}
                            </p>

                            {getDisplaySize(deal) && (
                              <p className="mt-1 text-xs text-gray-500">
                                Package:{" "}
                                {getDisplaySize(deal)}
                              </p>
                            )}

                          </div>

                        </div>


                        <div className="text-right">

                          <p className="text-2xl font-bold text-green-700">
                            ${price.toFixed(2)}
                            <span className="text-base">
                              {" / lb"}
                            </span>
                          </p>

                        </div>

                      </div>

                    );
                  }
                )}

              </div>


              {/* VIEW ALL BUTTON */}
              <div className="mt-6 text-center">

                <button
                  onClick={() =>
                    setShowAllDeals(
                      !showAllDeals
                    )
                  }
                  className="rounded-lg bg-green-700 px-8 py-3 font-semibold text-white hover:bg-green-800"
                >
                  {showAllDeals
                    ? "Hide All Deals"
                    : "View All Deals"}
                </button>

              </div>

            </div>

          )}


          {/* NO COMPARABLE DEALS */}
          {bestDeals.length === 0 && (
            <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-6 text-center">

              <p className="font-semibold text-gray-800">
                We found real products, but there is not enough unit information to safely compare them by pound.
              </p>

              <p className="mt-2 text-sm text-gray-600">
                We will not guess the price per pound.
              </p>

            </div>
          )}


          {/* ALL DEALS */}
          {showAllDeals && (

            <div className="mt-8 rounded-2xl border border-green-200 bg-white p-8 shadow-sm">

              <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                Real Deal Results
              </p>

              <h2 className="mt-2 text-3xl font-bold text-gray-900">
                {searchItem}
              </h2>

              <p className="mt-2 text-gray-600">
                Results for{" "}
                <strong>{postalCode}</strong>
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Searching Ontario
              </p>


              {/* ADONIS SOURCE */}
              <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm">

                <p className="font-semibold text-gray-800">
                  Adonis flyer
                </p>

                <a
                  href="https://www.groupeadonis.ca/en/flyer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 underline"
                >
                  View official Adonis Ontario flyer
                </a>

              </div>


              <div className="mt-6 space-y-4">

                {deals.map(
                  (
                    deal,
                    index
                  ) => {

                    const pricePerPound =
                      getDisplayPricePerPound(
                        deal
                      );

                    const displaySize =
                      getDisplaySize(
                        deal
                      );

                    return (

                      <div
                        key={
                          deal.store_name +
                          "-" +
                          deal.product_name +
                          "-" +
                          index
                        }
                        className="rounded-xl bg-green-50 p-6"
                      >

                        <p className="text-sm font-semibold text-green-700">
                          {index === 0
                            ? "RESULT"
                            : "DEAL"}
                        </p>


                        <h3 className="mt-2 text-xl font-bold text-gray-900">
                          {deal.product_name}
                        </h3>


                        <p className="mt-2 text-lg font-semibold text-gray-800">
                          {deal.store_name}
                        </p>


                        {/* PACKAGE SIZE */}
                        {displaySize && (
                          <p className="mt-1 text-gray-600">
                            Package:{" "}
                            {displaySize}
                          </p>
                        )}


                        {/* PRICE PER POUND */}
                        {pricePerPound !== null ? (

                          <p className="mt-3 text-4xl font-bold text-green-700">

                            $
                            {pricePerPound.toFixed(2)}

                            <span className="text-2xl">
                              {" / lb"}
                            </span>

                          </p>

                        ) : deal.price !== null ? (

                          <>
                            <p className="mt-3 text-4xl font-bold text-green-700">

                              $
                              {deal.price.toFixed(2)}

                            </p>

                            <p className="mt-1 text-sm font-semibold text-orange-700">
                              Unit price not confirmed
                            </p>
                          </>

                        ) : null}


                        {/* PACKAGE PRICE */}
                        {deal.price !== null &&
                          pricePerPound !== null && (

                            <p className="mt-2 text-sm text-gray-600">
                              Package price: $
                              {deal.price.toFixed(2)}
                            </p>

                          )}


                        {/* SALE BADGE */}
                        {deal.on_sale === true && (

                          <p className="mt-2 inline-block rounded-full bg-green-700 px-3 py-1 text-sm font-bold text-white">
                            ON SALE
                          </p>

                        )}

                      </div>

                    );
                  }
                )}

              </div>

            </div>

          )}

        </section>

      )}


      {/* FEATURE CARDS */}
      {!deals.length && (

        <section className="mx-auto max-w-6xl px-6 pb-12">

          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            What can you find?
          </h2>


          <div className="grid gap-6 md:grid-cols-3">

            <div className="rounded-xl bg-white p-6 shadow-sm">

              <p className="text-sm font-semibold text-green-700">
                GROCERY
              </p>

              <h3 className="mt-2 text-xl font-bold text-gray-900">
                Grocery Deals
              </h3>

              <p className="mt-2 text-gray-600">
                Search for milk, eggs, chicken, coffee and more.
              </p>

            </div>


            <div className="rounded-xl bg-white p-6 shadow-sm">

              <p className="text-sm font-semibold text-green-700">
                GAS
              </p>

              <h3 className="mt-2 text-xl font-bold text-gray-900">
                Gas Prices
              </h3>

              <p className="mt-2 text-gray-600">
                Find gas prices near your location.
              </p>

            </div>


            <div className="rounded-xl bg-white p-6 shadow-sm">

              <p className="text-sm font-semibold text-green-700">
                SHOPPING
              </p>

              <h3 className="mt-2 text-xl font-bold text-gray-900">
                Shopping Deals
              </h3>

              <p className="mt-2 text-gray-600">
                Search for products and compare prices.
              </p>

            </div>

          </div>

        </section>

      )}


      {/* FOOTER */}
      <footer className="border-t bg-white py-8 text-center text-gray-500">

        <p>
          SaveEveryDayDeals.com
        </p>

        <p className="mt-1 text-sm">
          Find today&apos;s deals. Save every day.
        </p>

      </footer>

    </main>
  );
}