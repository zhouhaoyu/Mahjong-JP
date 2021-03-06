const UI = {
    game: null as HTMLDivElement,
    cssRenderOverlay: null as HTMLDivElement,
    mainCanvas: null as HTMLCanvasElement,
    background: null as HTMLDivElement,
    logs: null as HTMLDivElement,
    doraIndicators: null as HTMLDivElement,
    gameResultBackground: null as HTMLDivElement,
    spectatorToolbar: null as HTMLDivElement,
    loadingContainer: null as HTMLDivElement
};

for (const id of Object.keys(UI)) UI[id] = document.getElementById(id);

class CenterInfo {
    private static readonly WRAPPER_CLASSNAME = "center-info-wrapper";
    private static readonly CONTAINER_CLASSNAME = "center-info";
    private static readonly ROUNDWIND_CLASSNAME = "round-wind";
    private static readonly TILELEFT_CLASSNAME = "tile-left";
    public readonly wrapper: HTMLDivElement;
    private _container: HTMLDivElement;
    private _roundWind: HTMLDivElement;
    private _tileLeft: HTMLDivElement;

    public get roundWind() {
        return this._roundWind.textContent;
    }
    public set roundWind(to: string) {
        this._roundWind.textContent = to;
    }

    public get tileLeft() {
        return this._tileLeft.textContent;
    }
    public set tileLeft(to: string) {
        this._tileLeft.textContent = to;
    }

    constructor() {
        this.wrapper = document.createElement("div");
        this.wrapper.className = CenterInfo.WRAPPER_CLASSNAME;
        this._container = document.createElement("div");
        this._container.className = CenterInfo.CONTAINER_CLASSNAME;
        this._roundWind = document.createElement("div");
        this._roundWind.className = CenterInfo.ROUNDWIND_CLASSNAME;
        this._tileLeft = document.createElement("div");
        this._tileLeft.className = CenterInfo.TILELEFT_CLASSNAME;
        this._container.appendChild(this._roundWind);
        this._container.appendChild(document.createElement("hr"));
        this._container.appendChild(this._tileLeft);
        this.wrapper.appendChild(this._container);
    }
}

class PlayerShout {
    public static readonly ANCHOR_BEGIN_POSZ = Tile.HEIGHT;
    public static readonly ANCHOR_END_POSZ = -Tile.HEIGHT;
    private static readonly SHOUT_CONTAINER_CLASSNAME = "shout-container";
    private static readonly SHOUT_CLASSNAME = "shout";
    private container: HTMLDivElement;
    private content: HTMLDivElement;
    constructor(public readonly player: Player) {
        this.container = document.createElement("div");
        this.container.className = PlayerShout.SHOUT_CONTAINER_CLASSNAME;
        this.content = document.createElement("div");
        this.content.className = PlayerShout.SHOUT_CLASSNAME;
        this.container.appendChild(this.content);
        UI.game.appendChild(this.container);
    }

    public shout(content: string): void {
        const absolutePos = new THREE.Vector3();
        absolutePos.setFromMatrixPosition(this.player.board.shoutBeginAnchor.matrixWorld);
        const beginPos = game.projectTo2D(absolutePos);
        absolutePos.setFromMatrixPosition(this.player.board.shoutEndAnchor.matrixWorld);
        const endPos = game.projectTo2D(absolutePos);
        const oneThirdPos = {
            x: (endPos.x - beginPos.x) / 3 + beginPos.x,
            y: (endPos.y - beginPos.y) / 3 + beginPos.y
        };
        const twoThirdPos = {
            x: ((endPos.x - beginPos.x) * 2) / 3 + beginPos.x,
            y: ((endPos.y - beginPos.y) * 2) / 3 + beginPos.y
        };
        const tl = new TimelineMax();
        this.content.textContent = content;
        this.container.style.display = "block";
        tl.fromTo(
            this.container,
            0.1,
            {
                scale: 0.8,
                opacity: 0,
                ...beginPos
            },
            {
                scale: 1,
                opacity: 1,
                ...oneThirdPos
            },
            0
        );
        tl.to(this.container, 0.6, {
            scale: 1.2,
            ...twoThirdPos
        });
        tl.to(this.container, 0.1, {
            scale: 3,
            opacity: 0,
            ...endPos
        });
        tl.call(() => (this.container.style.display = "none"));
    }
}

class PlayerUI implements Tickable {
    public static readonly PLAYERUI_ANCHOR_POSY = Tile.HEIGHT * 2;
    private static readonly CONTAINER_CLASSNAME = "player";
    private static readonly INFO_CLASSNAME = "info";
    private static readonly INFO_ACTIVE_CLASSNAME = "info active";
    private static readonly ACTIONBAR_CLASSNAME = "actions";
    private static readonly ACTIONBUTTON_CLASSNAME = "action";
    private container: HTMLDivElement;
    private info: HTMLDivElement;

    private actionBar: HTMLDivElement;
    private actionButtons: HTMLButtonElement[] = [];
    private _active = false;

    public get active() {
        return this._active;
    }

    public set active(to: boolean) {
        if (this._active === to) {
            return;
        }
        this._active = to;
        this.info.className = to ? PlayerUI.INFO_ACTIVE_CLASSNAME : PlayerUI.INFO_CLASSNAME;
        if (to) {
            Util.PlayerTurnLog`${this.player}的回合`;
        }
    }

    constructor(public readonly player: Player) {
        this.container = document.createElement("div");
        this.container.className = `${PlayerUI.CONTAINER_CLASSNAME} ${PlayerUI.CONTAINER_CLASSNAME}-${player.playerID}`;
        this.info = document.createElement("div");
        this.info.className = PlayerUI.INFO_CLASSNAME;
        this.info.innerHTML = `
            <div class="position">
                ${Util.POSITIONS[player.playerID]}
            </div>
            <img class="avatar" src="${player.info.imgid}" />
            <div class="name">${player.info.name}</div>
        `;
        this.actionBar = document.createElement("div");
        this.actionBar.className = PlayerUI.ACTIONBAR_CLASSNAME;

        this.container.appendChild(this.info);
        this.container.appendChild(this.actionBar);

        UI.game.appendChild(this.container);

        tickableManager.add(this);
    }

    private static setRelatedTilesEffect(action: Mahjong.Action, to: boolean) {
        if ("existing" in action) {
            for (const t of action.existing) {
                t.shaking = t.highlighted = to;
            }
        } else if (action.type === "LIZHI") {
            action.tile.shaking = action.tile.highlighted = to;
        }
    }

    public setActionButtons(actions: Mahjong.Action[]) {
        this.actionBar.innerHTML = "";
        this.actionButtons = [];
        for (const a of actions) {
            const button = document.createElement("button");
            button.className = `${PlayerUI.ACTIONBUTTON_CLASSNAME} ${PlayerUI.ACTIONBUTTON_CLASSNAME}-${a.type}`;
            button.textContent = Mahjong.actionInfo[a.type].chnName;
            let isHovered = false;
            button.addEventListener("click", e => {
                if (isHovered) {
                    this.onButtonClicked(e, a);
                }
            });
            button.addEventListener("mouseenter", () => {
                setTimeout(() => (isHovered = true), 1);
                PlayerUI.setRelatedTilesEffect(a, true);
            });
            button.addEventListener("mouseleave", () => {
                isHovered = false;
                PlayerUI.setRelatedTilesEffect(a, false);
            });
            this.actionBar.appendChild(button);
            this.actionButtons.push(button);
        }
        TweenMax.staggerFrom(this.actionButtons, 0.2, { opacity: 0, scale: 0, ease: Back.easeIn }, 0.1);
    }

    public onButtonClicked();
    public onButtonClicked(e: MouseEvent, action: Mahjong.Action);
    public onButtonClicked(e?: MouseEvent, action?: Mahjong.Action) {
        e && game.actionSubmissionEffect.showAt(Mahjong.needPlayTile(action) ? "playtile" : "checkmark", e);
        action && PlayerUI.setRelatedTilesEffect(action, false);
        if (this.actionButtons.length == 0) return;
        if (action) {
            this.player.doHumanAction(action);
        }
        this.actionButtons.forEach(b => b.remove());
        this.actionButtons = [];
    }

    public onTick() {
        const absolutePos = new THREE.Vector3();
        absolutePos.setFromMatrixPosition(this.player.board.playerUIAnchor.matrixWorld);
        const pos = game.projectTo2D(absolutePos);
        this.container.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }
}

class DoraIndicators {
    public static readonly DORA_COUNT = 5;
    private static readonly NORMAL_CONTAINER_CLASSNAME = "normal";
    private static readonly HIDDEN_CONTAINER_CLASSNAME = "hidden";
    public static readonly TILE_CLASSNAME = "tile";
    public static readonly OPEN_TILE_CLASSNAME = "tile open";
    public static readonly OPEN_DORA_TILE_CLASSNAME = "tile open dora";
    private normalContainer: HTMLDivElement;
    private hiddenContainer: HTMLDivElement;
    private tiles: HTMLDivElement[] = [];
    private hiddenTiles: HTMLDivElement[] = [];
    public readonly hiddenTileIDs: Mahjong.TileID[] = [];
    public readonly tileIDs: Mahjong.TileID[] = [];
    private _currentTileIDs: Mahjong.TileID[] = [];
    public get currentTileIDs() {
        return this._currentTileIDs;
    }
    public set currentTileIDs(to: Mahjong.TileID[]) {
        if (this._currentTileIDs === to) {
            return;
        }
        const oldIDs = this._currentTileIDs;
        this._currentTileIDs = to;
        for (const old of oldIDs) {
            Tile.updateDoras(Mahjong.getIndicatedDoraID(old));
        }
        for (const id of to) {
            Tile.updateDoras(Mahjong.getIndicatedDoraID(id));
        }
    }

    public updateAllDoras() {
        for (const id of this.currentTileIDs) {
            Tile.updateDoras(Mahjong.getIndicatedDoraID(id));
        }
    }

    constructor() {
        this.normalContainer = document.createElement("div");
        this.normalContainer.className = DoraIndicators.NORMAL_CONTAINER_CLASSNAME;
        UI.doraIndicators.appendChild(this.normalContainer);
        for (let i = 0; i < DoraIndicators.DORA_COUNT; i++) {
            const tile = document.createElement("div");
            tile.className = DoraIndicators.TILE_CLASSNAME;
            this.normalContainer.appendChild(tile);
            this.tiles.push(tile);
        }
        this.hiddenContainer = document.createElement("div");
        this.hiddenContainer.className = DoraIndicators.HIDDEN_CONTAINER_CLASSNAME;
        this.hiddenContainer.innerHTML = "<header><hr /><span>里宝牌指示牌</span><hr /></header>";
        UI.doraIndicators.appendChild(this.hiddenContainer);
        for (let i = 0; i < DoraIndicators.DORA_COUNT; i++) {
            const tile = document.createElement("div");
            tile.className = DoraIndicators.TILE_CLASSNAME;
            this.hiddenContainer.appendChild(tile);
            this.hiddenTiles.push(tile);
        }
    }

    public reveal(tileID: Mahjong.TileID) {
        Util.Assert`翻开的宝牌指示牌不超过5张：${this.tileIDs.length < 5}`;
        const tile = this.tiles[this.tileIDs.length];
        tile.appendChild(Assets.loadedImages[tileID].cloneNode());
        this.tileIDs.push(tileID);
        const tl = new TimelineMax();
        tl.add(Util.BiDirectionConstantSet(tile, "className", DoraIndicators.OPEN_TILE_CLASSNAME));
        tl.add(Util.BiDirectionConstantSet(this, "currentTileIDs", [...this.tileIDs]));
        return tl;
    }

    public revealHidden(tileIDs: Mahjong.TileID[]) {
        for (let i = 0; i < tileIDs.length; i++) {
            const tile = this.hiddenTiles[i];
            tile.className = DoraIndicators.OPEN_TILE_CLASSNAME;
            tile.appendChild(Assets.loadedImages[tileIDs[i]].cloneNode());
            this.hiddenTileIDs.push(tileIDs[i]);
        }
        const tl = new TimelineMax();
        tl.set(this.hiddenContainer.style, {
            display: "block",
            immediateRender: false
        });
        tl.fromTo(
            this.hiddenContainer,
            0.3,
            {
                y: "-100%",
                opacity: 0
            },
            {
                y: "0%",
                opacity: 1,
                immediateRender: false
            }
        );
        return tl;
    }
}

type GameResult =
    | {
          player: Player;
          newTile: Mahjong.TileID;
          from: number;
          type: "ZIMO" | "HU";
          fan: string[];
          score: number;
          fu: number;
      }
    | {
          player: Player;
          type: "DRAW";
          reason: string;
          score: number;
      }
    | {
          player: Player;
          type: "LIUMAN";
          score: number;
      }
    | {
          player: Player;
          type: "ERROR";
          reason: string;
          score: number;
      };

class GameResultView {
    private static readonly MAIN_CLASSNAME = "game-result";
    private static readonly ACTIVE_CLASSNAME = "active";
    private static readonly BLUR_CLASSNAME = "blur";
    private static getHTMLForResult(result: GameResult) {
        if (result.type === "LIUMAN") {
            return `
            <div class="result">
                <div class="result-upper">
                    <div class="player">
                        <img class="avatar" src="${result.player.info.imgid}" />
                        <span class="position">${Util.POSITIONS[result.player.playerID]}家</span>
                        <span class="name">${result.player.info.name}</span>
                    </div>
                    <div class="hu">流局满贯</div>
                </div>
                <div class="fan">
                    <label>当前得分</label>
                    <span>${result.score}</span>
                </div>
            </div>
            `;
        }
        if (result.type === "DRAW") {
            return `
            <div class="result">
                <div class="result-upper">
                    <div class="player">
                        <img class="avatar" src="${result.player.info.imgid}" />
                        <span class="position">${Util.POSITIONS[result.player.playerID]}家</span>
                        <span class="name">${result.player.info.name}</span>
                    </div>
                    <div class="draw">流局</div>
                </div>
                <div class="fan">
                    <label>原因</label>
                    <span>${result.reason}</span>
                    <label>当前得分</label>
                    <span>${result.score}</span>
                </div>
            </div>
            `;
        }
        if (result.type === "ERROR") {
            return `
            <div class="result">
                <div class="result-upper">
                    <div class="player">
                        <img class="avatar" src="${result.player.info.imgid}" />
                        <span class="position">${Util.POSITIONS[result.player.playerID]}家</span>
                        <span class="name">${result.player.info.name}</span>
                    </div>
                    <div class="draw">错误</div>
                </div>
                <div class="fan">
                    <label>原因</label>
                    <span>${result.reason}</span>
                    <label>当前得分</label>
                    <span>${result.score}</span>
                </div>
            </div>
            `;
        }
        return `
        <div class="result">
            <div class="result-upper">
                <div class="player">
                    <img class="avatar" src="${result.player.info.imgid}" />
                    <span class="position">${Util.POSITIONS[result.player.playerID]}家</span>
                    <span class="name">${result.player.info.name}</span>
                </div>
                <div class="hu">
                    <span class="type">${Mahjong.actionInfo[result.type].chnName}</span>
                    ${result.type === "HU" ? `<span class="from">${Util.POSITIONS[result.from]}家点炮</span>` : ""}
                </div>
            </div>
            <div class="deck">
                ${[
                    result.player.board.deck.handTiles.map(t => t.tileID),
                    ...result.player.board.openTiles.openStacks.map(s => s.tiles.map(t => (t.close ? null : t.tileID))),
                    [result.newTile]
                ]
                    .map(
                        tileGroup =>
                            `<div class="group">${tileGroup
                                .map(t => {
                                    if (!t) {
                                        return `<div class="${DoraIndicators.TILE_CLASSNAME}"></div>`;
                                    }
                                    const isDora =
                                        Mahjong.isFixedDora(t) ||
                                        [...game.doraIndicators.tileIDs, ...game.doraIndicators.hiddenTileIDs].some(
                                            id => Mahjong.getIndicatedDoraID(id) === t
                                        );
                                    return `<div class="${
                                        isDora
                                            ? DoraIndicators.OPEN_DORA_TILE_CLASSNAME
                                            : DoraIndicators.OPEN_TILE_CLASSNAME
                                    }">
                                        <img src="${Assets.loadedImages[t].src}" />
                                    </div>`;
                                })
                                .join("")}</div>`
                    )
                    .join("")}
            </div>
            <div class="fan">
                <label>番型</label>
                ${result.fan.map(f => `<span>${f}</span>`).join("")}
            </div>
            <div class="score">
                <label>胡牌得分</label>
                <span>+${result.score}</span>
                ${result.fu ? `<label>符数</label><span>${result.fu}</span>` : ""}
            </div>
        </div>
        `;
    }

    public setResult(results: GameResult[]) {
        const gameResultView = document.createElement("div");
        gameResultView.className = GameResultView.MAIN_CLASSNAME;
        gameResultView.innerHTML =
            "<header><span>本局结果</span><hr /></header>" + results.map(GameResultView.getHTMLForResult).join("");
        UI.gameResultBackground.appendChild(gameResultView);
        const tl = new TimelineMax();
        tl.add(Util.BiDirectionConstantSet(game, "pause", true));
        tl.add(Util.BiDirectionConstantSet(UI.game, "className", GameResultView.BLUR_CLASSNAME));
        tl.add(Util.BiDirectionConstantSet(UI.gameResultBackground, "className", GameResultView.ACTIVE_CLASSNAME));
        tl.fromTo(
            UI.gameResultBackground,
            0.2,
            { opacity: 0 },
            { opacity: 1, ease: Linear.easeNone, immediateRender: false }
        );
        tl.set(gameResultView, { display: "block", immediateRender: false }, 1);
        tl.fromTo(gameResultView, 0.5, { y: 300 }, { y: 0, immediateRender: false, ease: Back.easeOut });
        tl.from(gameResultView.querySelector("header"), 0.1, { y: "-100%", opacity: 0 });
        for (const element of gameResultView.querySelectorAll(".result")) {
            tl.from(element.querySelector(".result-upper > .player"), 0.1, { opacity: 0 });
            tl.from(element.querySelector(".result-upper > :not(.player)"), 0.1, { x: "-100%", opacity: 0 }, "-=0.1");
            tl.staggerFrom(element.querySelectorAll(".deck .tile"), 0.2, { y: "100%", opacity: 0 }, 0.05);
            tl.staggerFrom(element.querySelectorAll(".fan > *, .score > *"), 0.3, { x: "-100%", opacity: 0 }, 0.02);
        }
        return tl;
    }
}

class ActionSubmissionEffect {
    private static CHECKMARK_CLASSNAME = "mouse-effect checkmark";
    private static SHOULDTHENPLAYTILE_CLASSNAME = "mouse-effect should-then-play-tile";
    private checkmark: HTMLDivElement;
    private shouldThenPlayTile: HTMLDivElement;
    constructor() {
        this.checkmark = document.createElement("div");
        this.checkmark.className = ActionSubmissionEffect.CHECKMARK_CLASSNAME;
        this.shouldThenPlayTile = document.createElement("div");
        this.shouldThenPlayTile.className = ActionSubmissionEffect.SHOULDTHENPLAYTILE_CLASSNAME;
        UI.game.appendChild(this.checkmark);
        UI.game.appendChild(this.shouldThenPlayTile);
    }

    public showAt(type: "checkmark" | "playtile", e: MouseEvent) {
        const tl = new TimelineMax();
        const element = type === "checkmark" ? this.checkmark : this.shouldThenPlayTile;
        element.style.opacity = "0";
        element.style.display = "block";
        tl.set(element, game.getLeftTopRelatedXY(e));
        if (type === "checkmark") {
            tl.fromTo(element, 0.1, { opacity: 0 }, { opacity: 0.3 });
            tl.fromTo(element, 0.3, { scale: 3 }, { opacity: 1, scale: 1, ease: Expo.easeIn });
            tl.to(element, 0.6, { opacity: 0 }, "+=0.3");
        } else {
            tl.fromTo(element, 0.1, { opacity: 0, scale: 0 }, { opacity: 0.5, scale: 1 });
            tl.to(element, 0.3, { opacity: 0, scale: 3, ease: Expo.easeIn });
        }
        tl.set(element, { display: "none" });
    }
}

class SpectatorControl implements Tickable {
    private static ACTIVE_CLASSNAME = "active";
    private progress: HTMLInputElement;
    private toggleTopView: HTMLButtonElement;
    public set visible(to: boolean) {
        UI.spectatorToolbar.style.display = to ? "block" : "none";
    }
    public set isTopViewing(to: boolean) {
        this.toggleTopView.className = to ? SpectatorControl.ACTIVE_CLASSNAME : "";
    }
    constructor() {
        const left = document.createElement("button");
        const toggleOpen = document.createElement("button");
        this.toggleTopView = document.createElement("button");
        const right = document.createElement("button");
        left.textContent = "上家视角";
        left.addEventListener("click", () => {
            game.viewPoint = (game.viewPoint + 3) % 4;
        });
        toggleOpen.textContent = "亮牌";
        toggleOpen.addEventListener("click", () => {
            const shouldOpen = !game.openAll;
            game.openAll = shouldOpen;
            toggleOpen.className = shouldOpen ? SpectatorControl.ACTIVE_CLASSNAME : "";
        });
        this.toggleTopView.textContent = "俯瞰";
        this.toggleTopView.addEventListener("click", () => {
            game.topView = !game.topView;
        });
        right.textContent = "下家视角";
        right.addEventListener("click", () => {
            game.viewPoint = (game.viewPoint + 1) % 4;
        });
        UI.spectatorToolbar.appendChild(left);
        UI.spectatorToolbar.appendChild(toggleOpen);
        UI.spectatorToolbar.appendChild(this.toggleTopView);
        UI.spectatorToolbar.appendChild(right);

        if (infoProvider["dbgMode"]) {
            document.addEventListener("keydown", e => {
                if (e.keyCode === 187) Loader.globalTL.timeScale(Loader.globalTL.timeScale() * 2);
                if (e.keyCode === 189) Loader.globalTL.timeScale(Loader.globalTL.timeScale() / 2);
            });

            UI.spectatorToolbar.style.bottom = "2em";
            this.progress = document.createElement("input");
            this.progress.type = "range";
            this.progress.max = "1";
            this.progress.min = "0";
            this.progress.step = "any";
            this.progress.addEventListener("mousedown", () => {
                tickableManager.delete(this);
                Loader.globalTL.pause();
            });
            this.progress.addEventListener("mouseup", () => {
                tickableManager.add(this);
                Loader.globalTL.play();
            });
            this.progress.addEventListener("input", e =>
                Loader.globalTL.progress(parseFloat((e.target as HTMLInputElement).value), true)
            );
            tickableManager.add(this);
            document.body.appendChild(this.progress);
        }
    }
    public onTick() {
        this.progress.value = Loader.globalTL.progress().toString();
    }
}
