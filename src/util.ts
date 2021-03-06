namespace Util {
    export const RAD90 = Math.PI / 2;
    export const ZERO3 = new THREE.Vector3();
    export const ZERO2 = new THREE.Vector2();
    export const DIR_X = [0, 1, 0, -1];
    export const DIR_Z = [1, 0, -1, 0];
    export const POSITIONS = "东南西北";
    export function FanToChn(x: number) {
        if (x === 26) {
            return "两倍役满";
        }
        if (x === 13) {
            return "役满";
        }
        return x + "番";
    }
    export function IDENTITY<T>(x: T) {
        return x;
    }

    const dummy = document.createElement("span");
    export function neutralize(str: string | number) {
        dummy.textContent = str.toString();
        return dummy.innerHTML;
    }

    export function LessOne<T>(array: T[], one: T) {
        const idx = array.indexOf(one);
        const result = [...array];
        result.splice(idx, 1);
        return result;
    }

    export function RandInArray<T>(array: T[]) {
        return array[Math.floor(Math.random() * array.length)];
    }

    export function ToPlain(v: THREE.Quaternion): Pick<THREE.Quaternion, "x" | "y" | "z" | "w">;
    export function ToPlain(v: THREE.Vector3 | THREE.Euler): Pick<THREE.Vector3, "x" | "y" | "z">;
    export function ToPlain(v: THREE.Vector3 | THREE.Euler | THREE.Quaternion) {
        if ("w" in v) {
            return {
                x: v.x,
                y: v.y,
                z: v.z,
                w: v.w
            };
        }
        return {
            x: v.x,
            y: v.y,
            z: v.z
        };
    }

    export function GetRelativePlayerPosition(me: number, other: number) {
        return ((me + 4 - other) % 4) - 2;
    }

    export function MeshOpacityFromTo(m: THREE.Mesh, duration: number, from: number, to: number) {
        if (!Array.isArray(m.material)) {
            const t = TweenMax.fromTo(
                m.material,
                duration,
                { opacity: from },
                { opacity: to, ease: Linear.easeNone, immediateRender: false }
            );
            if ((from == 0 || from == 1) && to + from == 1 && !m.material.transparent) {
                const tl = new TimelineMax();
                if (to) {
                    tl.add(BiDirectionConstantSet(m, "visible", true), 0);
                    tl.add(BiDirectionConstantSet(m.material, "transparent", true), 0);
                    tl.add(t, 0);
                    tl.add(BiDirectionConstantSet(m.material, "transparent", false));
                } else {
                    tl.add(BiDirectionConstantSet(m.material, "transparent", true), 0);
                    tl.add(t, 0);
                    tl.add(BiDirectionConstantSet(m.material, "transparent", false));
                    tl.add(BiDirectionConstantSet(m, "visible", false));
                }
                return tl;
            }
            return t;
        }
    }

    export function BiDirectionConstantSet<T>(obj: T | T[], propName: keyof T, to: any) {
        return TweenMax.set(obj, { [propName]: to, immediateRender: false });
        // let initial: any;
        // if (Array.isArray(obj))
        //     return TweenMax.to({}, 0.001, {
        //         immediateRender: false,
        //         onComplete: function() {
        //             initial = obj[0] && obj[0][propName];
        //             if (to instanceof Function) to = to();
        //             obj.forEach(function(o) {
        //                 return (o[propName] = to);
        //             });
        //         },
        //         onReverseComplete: function() {
        //             return obj.forEach(function(o) {
        //                 return (o[propName] = initial);
        //             });
        //         }
        //     });
        // else
        //     return TweenMax.to({}, 0.001, {
        //         immediateRender: false,
        //         onComplete: function() {
        //             initial = obj[propName];
        //             if (to instanceof Function) obj[propName] = to();
        //             else obj[propName] = to;
        //         },
        //         onReverseComplete: function() {
        //             return (obj[propName] = initial);
        //         }
        //     });
    }

    function playerInfoToHTML(x: Player) {
        return `<span>${POSITIONS[x.playerID]}</span>家 <img src="${x.info.imgid}" /><span>${neutralize(
            x.info.name
        )}</span>`;
    }

    function logComposeHTML(parts: TemplateStringsArray, args: Array<number | string | Player | Array<Player>>) {
        return parts.reduce((prev, curr, i) => {
            const arg = args[i - 1];
            if (Array.isArray(arg)) {
                return `${prev}${arg.map(p => playerInfoToHTML(p)).join("、")}${curr}`;
            }
            if (typeof arg === "object") {
                return `${prev}${playerInfoToHTML(arg)}${curr}`;
            }
            return `${prev}<span>${neutralize(arg)}</span>${curr}`;
        });
    }

    export function Log(parts: TemplateStringsArray, ...args: Array<number | string | Player | Array<Player>>) {
        const newChild = document.createElement("div");
        newChild.innerHTML = logComposeHTML(parts, args);
        UI.logs.appendChild(newChild);
        const tl = new TimelineMax();
        tl.from(newChild, 0.1, { opacity: 0 });
        tl.to(newChild, 0.1, { height: 0, onComplete: () => UI.logs.removeChild(newChild) }, 2);
    }

    function CreatePrimaryLogger(channel: string) {
        return (parts: TemplateStringsArray, ...args: Array<number | string | Player | Array<Player>>) => {
            const newChild = document.createElement("div");
            newChild.className = "primary " + channel;
            newChild.innerHTML = logComposeHTML(parts, args);
            const oldLogs = UI.logs.querySelectorAll(".primary." + channel);
            for (let i = 0; i < oldLogs.length; i++) {
                const c = oldLogs[i];
                TweenMax.to(c, 0.1, {
                    height: 0,
                    onComplete: () => {
                        try {
                            UI.logs.removeChild(c);
                        } catch {}
                    },
                    delay: i === oldLogs.length - 1 ? 1 : 0
                });
            }
            UI.logs.appendChild(newChild);
            TweenMax.from(newChild, 0.1, { opacity: 0 });
        };
    }

    export const PlayerTurnLog = CreatePrimaryLogger("turn");
    export const PlayerActionLog = CreatePrimaryLogger("action");

    export function Assert(parts: TemplateStringsArray, ...args: Array<boolean>) {
        if (args.some(v => !v)) {
            const newChild = document.createElement("div");
            newChild.className = "error";
            newChild.innerHTML =
                "断言失败 - " +
                parts.reduce((prev, curr, i) => {
                    return `${prev}<span>${args[i - 1]}</span>${curr}`;
                });
            UI.logs.appendChild(newChild);
            TweenMax.from(newChild, 0.1, { opacity: 0 });
            throw new Error(newChild.textContent);
        }
    }
}
