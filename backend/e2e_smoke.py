"""Live end-to-end smoke test: Yahoo data -> backtest -> optimization."""
from app.backtest import BacktestConfig, ParamSpace, get_strategy, optimize, run_backtest
from app.data import fetch_candles


def main() -> None:
    # 1) Live data from Yahoo Finance (NSE)
    data = fetch_candles("RELIANCE", period="2y", interval="1d")
    print(f"DATA: {len(data)} candles, {data.index.min().date()} -> {data.index.max().date()}")
    print(f"LAST CLOSE: {data['Close'].iloc[-1]:.2f}")

    # 2) Backtest EMA crossover
    sig = get_strategy("ema_crossover")(data, {"fast": 20, "slow": 50})
    res = run_backtest(data, sig, BacktestConfig(initial_capital=100_000))
    m = res.metrics
    print(
        f"BACKTEST: ret={m['total_return_pct']}% sharpe={m['sharpe']} "
        f"maxDD={m['max_drawdown_pct']}% trades={m['n_trades']} "
        f"winrate={m['win_rate_pct']}% costs=Rs{m['total_costs']}"
    )

    # 3) Optimization (small trial run)
    space = ParamSpace(ints={"fast": (5, 40), "slow": (30, 150)})
    opt = optimize(data, "ema_crossover", space, n_trials=15, n_splits=4, seed=42)
    print(
        f"OPTIMIZE: best={opt.best_params} train_obj={opt.best_train_objective} "
        f"oos_sharpe={opt.oos_mean.get('sharpe')} oos_ret={opt.oos_mean.get('total_return_pct')}%"
    )
    print("E2E OK")


if __name__ == "__main__":
    main()
