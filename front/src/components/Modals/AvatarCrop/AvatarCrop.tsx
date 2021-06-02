import Dialog from "../Dialog";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import utils from "../../../lib/utils";
import Slider from "../../Forms/Slider";
import { useAppDispatch } from "../../../store/hooks";
import { rootActions } from "../../../store/reducers/root";
import Button from "../../Forms/Button";
import { usePrev } from "../../../lib/hooks";
import { ModalBase } from "../../../lib/types";

export interface AvatarCropProps extends ModalBase {
    image: File,
    callback: (cropped: Blob | null, modalId: string) => Promise<void>
}

const colors = [
    "transparent",
    "red",
    "orange",
    "yellow",
    "lime",
    "cyan",
    "blue",
    "magenta"
];

let grabbed = false;
let width = 0, height = 0;

const defaultMaxScale = 3.0;
const defaultMinScale = 0.05;
const defaultScaleStep = 0.05;

const AvatarCrop = React.forwardRef<HTMLDivElement, AvatarCropProps>((props, ref) => {
    const {t} = useTranslation();
    const dispatch = useAppDispatch();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(false);
    const [cropState, setCropState] = useState({
        hasAlpha: false,
        pickedColor: "transparent",
        dim: 350,
        img: new Image(),
    });

    const [zoomState, setZoomState] = useState({
        scale: defaultMinScale,
        minScale: defaultMinScale,
        maxScale: defaultMaxScale,
        scaleStep: defaultScaleStep,
    });

    const [canvasPos, setCanvasPos] = useState({ x: 0, y: 0 });
    const prevScale = usePrev(zoomState.scale) ?? zoomState.scale;

    function handleChangeFillColor(e: React.MouseEvent<HTMLElement>, index: number) {
        if(e.button !== 0) {
            return;
        }

        if(index === colors.length) {
            utils.pickColor(e.clientX, e.clientY).then(value => {
                if(value === null) {
                    return;
                }

                setCropState({...cropState, pickedColor: value});
            });
        } else {
            setCropState({...cropState, pickedColor: colors[index]})
        }
    }

    function handleAvatarWheel(e: React.WheelEvent<HTMLDivElement>) {
        if(e.deltaY < 0) {
            zoom(zoomState.scale + zoomState.scaleStep);
        } else {
            zoom(zoomState.scale - zoomState.scaleStep);
        }
    }

    const updateCanvasPos = useCallback(function updateCanvasPos(newX: number, newY: number) {
        if(!canvasRef.current) {
            return;
        }

        const w = canvasRef.current.width * zoomState.scale;
        const h = canvasRef.current.height * zoomState.scale;

        if(newX > 0) {
            newX = 0;
        } else if(newX < -w + cropState.dim) {
            newX = -w + cropState.dim;
        }

        if(newY > 0) {
            newY = 0;
        } else if(newY < -h + cropState.dim) {
            newY = -h + cropState.dim;
        }

        setCanvasPos({x: newX, y: newY});
    }, [zoomState.scale, cropState.dim]);

    function handleAvatarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if(!grabbed) {
            return;
        }

        updateCanvasPos(canvasPos.x + e.movementX, canvasPos.y + e.movementY);
    }

    function handleAvatarMouseDown(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        grabbed = true;
    }

    function zoom(val: number) {
        if(val > zoomState.maxScale) {
            val = zoomState.maxScale;
        }

        if(val < zoomState.minScale) {
            val = zoomState.minScale;
        }

        if(val !== zoomState.scale) {
            setZoomState({...zoomState, scale: val});
        }
    }

    useEffect(() => {
        if(!canvasRef.current) {
            return;
        }

        canvasRef.current.style.transform = `scale(${zoomState.scale})`;
        let d = cropState.dim / 2 * (prevScale - zoomState.scale) / prevScale;
        let mult = Math.abs(d / (cropState.dim / 2)) + 1;

        let newX = canvasPos.x * mult + d;
        let newY = canvasPos.y * mult + d;

        if(prevScale > zoomState.scale) {
            d = cropState.dim / 2 * (zoomState.scale - prevScale) / zoomState.scale;
            mult = Math.abs(d / (cropState.dim / 2)) + 1;

            newX = (canvasPos.x - d) / mult;
            newY = (canvasPos.y - d) / mult;
        }

        updateCanvasPos(newX, newY);
        /* eslint-disable */
    }, [zoomState.scale]);

    function handleZoomBtn(e: React.MouseEvent<HTMLElement>, out: boolean = true) {
        if(out) {
            zoom(zoomState.scale - zoomState.scaleStep);
        } else {
            zoom(zoomState.scale + zoomState.scaleStep);
        }
    }

    function handleCancelBtn(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        dispatch(rootActions.hideModal(props.id));
    }

    async function handleUploadBtn(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        const x = -canvasPos.x / zoomState.scale;
        const y = -canvasPos.y / zoomState.scale;
        const d = Math.floor(cropState.dim / zoomState.scale);

        const newCanvas = document.createElement("canvas");
        const ctx = newCanvas.getContext("2d");
        newCanvas.width = width;
        newCanvas.height = height;

        if(cropState.hasAlpha) {
            ctx!.fillStyle = cropState.pickedColor;
            ctx!.fillRect(0, 0, width, height);
        }

        ctx!.drawImage(cropState.img, 0, 0);
        const imageData = ctx!.getImageData(x, y, d, d);

        newCanvas.width = newCanvas.height = d;
        ctx!.putImageData(imageData, 0, 0);

        setLoading(true);
        await props.callback(await new Promise((r: BlobCallback) => {
            newCanvas.toBlob(r, "image/jpeg");
        }), props.id!);

        setLoading(false);
    }

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = e => {
            cropState.img.onload = e => {
                if(!canvasRef.current) {
                    return;
                }

                const dim = canvasRef.current.parentElement!.offsetWidth;
                const ctx = canvasRef.current.getContext("2d");

                width = canvasRef.current.width = cropState.img.width;
                height = canvasRef.current.height = cropState.img.height;

                ctx!.drawImage(cropState.img, 0, 0);

                //calc scale boundaries
                let maxSide = width;
                let minSide = height;

                let maxScale = defaultMaxScale;
                let minScale = defaultMinScale;
                let scaleStep = defaultScaleStep;

                if(width < height) {
                    maxSide = height;
                    minSide = width;
                }

                let scaleStepsCount = maxSide / dim * 10;

                if(maxSide < dim) {
                    maxScale = dim / maxSide * 3;
                    scaleStepsCount = 10;
                }

                minScale = dim / minSide;
                scaleStep = (maxScale - minScale) / scaleStepsCount;
                setZoomState({maxScale, minScale, scale: minScale, scaleStep});

                if(dim !== cropState.dim) {
                    setCropState({...cropState, dim});
                }

                //detect if image has alpha
                new Promise(async (r: (value: boolean) => void) => {
                    if(maxSide === width) {
                        for(let i = 0; i < maxSide; i+=4) {
                            const j = Math.trunc(i * (minSide / maxSide));

                            const data = ctx!.getImageData(i, j, 1, 1);
                            const data2 = ctx!.getImageData(i, height - j - 1, 1, 1);

                            if(data.data[3] < 255 || data2.data[3] < 255) {
                                r(true);
                                return;
                            }
                        } 
                    } else {
                        for(let i = 0; i < maxSide; i+=4) {
                            const j = Math.trunc(i * (minSide / maxSide));

                            const data = ctx!.getImageData(j, i, 1, 1);
                            const data2 = ctx!.getImageData(width - j - 1, i, 1, 1);

                            if(data.data[3] < 255 || data2.data[3] < 255) {
                                r(true);
                                return;
                            }
                        }
                    }

                    const iData = ctx!.getImageData(0, 0, width, height);

                    for(let i = 0; i < iData.data.length; i+=4) {
                        if(iData.data[i + 3] < 255) {
                            r(true);
                            return;
                        }
                    }

                    r(false);
                }).then(value => {
                    if(cropState.hasAlpha !== value) {
                        setCropState({...cropState, hasAlpha: value});
                    }
                });
            };

            cropState.img.src = reader.result as string;
        };

        reader.readAsDataURL(props.image);

        function handleWindowMouseUp(e: MouseEvent) {
            grabbed = false;
        }

        window.addEventListener("mouseup", handleWindowMouseUp);

        return () => {
            window.removeEventListener("mouseup", handleWindowMouseUp);
        }
    }, [props.image, cropState]);

    return (
        <Dialog 
            ref={ref}  
            header={<h3>{t("avatar_crop_modal_header")}</h3>} 
            footer={
                <>
                    <div onClick={handleCancelBtn}>{t("btn:cancel")}</div>
                    <div>
                        <Button loading={loading} text="continue" onClick={handleUploadBtn} />
                    </div>
                </>
            }
            {...props}
        >
            <div className="body-wrapper">
                <div className={cropState.hasAlpha ? "fill-colors has-alpha" : "fill-colors"}>
                    {colors.map((c, index) => (
                        <div 
                            key={c}  
                            title={index === 0 ? t("avatar_color_reset_title") : ""}
                            style={{background: c}}
                            className={cropState.pickedColor === c ? "active" : ""}
                            onClick={e => handleChangeFillColor(e, index)}
                        />
                    ))}
                    <div 
                        className={colors.indexOf(cropState.pickedColor) < 0 ? "active" : ""}
                        title={t("avatar_color_pick_title")}
                        style={{background: "conic-gradient(yellow, lime, blue, violet, red)"}} 
                        onClick={e => handleChangeFillColor(e, colors.length)}
                    />
                </div>
                <div 
                    className="avatar-frame" 
                    style={{backgroundColor: cropState.pickedColor}}
                    onWheel={handleAvatarWheel}
                    onMouseMove={handleAvatarMouseMove}
                    onMouseDown={handleAvatarMouseDown}
                >
                    <canvas ref={canvasRef} style={{top: `${canvasPos.y}px`, left: `${canvasPos.x}px`}}></canvas>
                </div>
                <div className="zoom">
                    <img 
                        alt="zoom_in_icon" 
                        src="/img/addpl.svg" 
                        className="svg hover" 
                        onClick={e => handleZoomBtn(e, false)} 
                    />
                    <Slider 
                        value={zoomState.scale} 
                        min={zoomState.minScale} 
                        max={zoomState.maxScale} 
                        step={zoomState.scaleStep} 
                        vertical 
                        thumb 
                        onInput={zoom} 
                    />
                    <img 
                        alt="zoom_out_icon" 
                        src="/img/minus.svg" 
                        className="svg hover" 
                        onClick={e => handleZoomBtn(e)} 
                    />
                </div>
            </div>
        </Dialog>
    );
});

export default AvatarCrop;