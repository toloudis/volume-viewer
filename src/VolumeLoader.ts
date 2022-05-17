import Volume, { ImageInfo } from "./Volume";
import { openArray, openGroup, HTTPStore } from "zarr";

/**
 * @callback PerChannelCallback
 * @param {string} imageurl
 * @param {number} channelindex
 */
type PerChannelCallback = (imageurl: string, channelIndex: number) => void;

interface PackedChannelsImage {
  name: string;
  channels: number[];
}
type PackedChannelsImageRequests = Record<string, HTMLImageElement>;

/**
 * @class
 */
export default class VolumeLoader {
  /**
   * load per-channel volume data from a batch of image files containing the volume slices tiled across the images
   * @param {Volume} volume
   * @param {Array.<{name:string, channels:Array.<number>}>} imageArray
   * @param {PerChannelCallback} callback Per-channel callback.  Called when each channel's atlased volume data is loaded
   * @returns {Object.<string, Image>} a map(imageurl : Image object) that should be used to cancel the download requests,
   * for example if you need to destroy the image before all data has arrived.
   * as requests arrive, the callback will be called per image, not per channel
   * @example loadVolumeAtlasData([{
   *     "name": "AICS-10_5_5.ome.tif_atlas_0.png",
   *     "channels": [0, 1, 2]
   * }, {
   *     "name": "AICS-10_5_5.ome.tif_atlas_1.png",
   *     "channels": [3, 4, 5]
   * }, {
   *     "name": "AICS-10_5_5.ome.tif_atlas_2.png",
   *     "channels": [6, 7, 8]
   * }], mycallback);
   */
  static loadVolumeAtlasData(
    volume: Volume,
    imageArray: PackedChannelsImage[],
    callback: PerChannelCallback
  ): PackedChannelsImageRequests {
    const numImages = imageArray.length;

    const requests = {};
    //console.log("BEGIN DOWNLOAD DATA");
    for (let i = 0; i < numImages; ++i) {
      const url = imageArray[i].name;
      const batch = imageArray[i].channels;

      // using Image is just a trick to download the bits as a png.
      // the Image will never be used again.
      const img: HTMLImageElement = new Image();
      img.onerror = function () {
        console.log("ERROR LOADING " + url);
      };
      img.onload = (function (thisbatch) {
        return function (event: Event) {
          //console.log("GOT ch " + me.src);
          // extract pixels by drawing to canvas
          const canvas = document.createElement("canvas");
          // nice thing about this is i could downsample here
          const w = Math.floor((event?.target as HTMLImageElement).naturalWidth);
          const h = Math.floor((event?.target as HTMLImageElement).naturalHeight);
          canvas.setAttribute("width", "" + w);
          canvas.setAttribute("height", "" + h);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.log("Error creating canvas 2d context for " + url);
            return;
          }
          ctx.globalCompositeOperation = "copy";
          ctx.globalAlpha = 1.0;
          ctx.drawImage(event?.target as CanvasImageSource, 0, 0, w, h);
          // getImageData returns rgba.
          // optimize: collapse rgba to single channel arrays
          const iData = ctx.getImageData(0, 0, w, h);

          const channelsBits: Uint8Array[] = [];
          // allocate channels in batch
          for (let ch = 0; ch < Math.min(thisbatch.length, 4); ++ch) {
            channelsBits.push(new Uint8Array(w * h));
          }
          // extract the data
          for (let j = 0; j < Math.min(thisbatch.length, 4); ++j) {
            for (let px = 0; px < w * h; px++) {
              channelsBits[j][px] = iData.data[px * 4 + j];
            }
          }

          // done with img, iData, and canvas now.

          for (let ch = 0; ch < Math.min(thisbatch.length, 4); ++ch) {
            volume.setChannelDataFromAtlas(thisbatch[ch], channelsBits[ch], w, h);
            callback(url, thisbatch[ch]);
          }
        };
      })(batch);
      img.crossOrigin = "Anonymous";
      img.src = url;
      requests[url] = img;
    }

    return requests;
  }

  // loadVolumeAICS(url:string, callback:PerChannelCallback) : Promise<Volume> {
  //   // note that volume is returned before channel data is ready.
  //   return fetch(url)
  //     .then(function(response) {
  //       return response.json();
  //     })
  //     .then(function(myJson) {
  //       // if you need to adjust image paths prior to download,
  //       // now is the time to do it:
  //       // myJson.images.forEach(function(element) {
  //       //     element.name = myURLprefix + element.name;
  //       // });
  //       const vol = new Volume(myJson);

  //       volumeLoader.loadVolumeAtlasData(
  //         vol, myJson.images, callback);
  //       return vol;
  //     });
  // },

  /**
   * load 5d ome-zarr into Volume object
   * @param {string} url
   * @param {PerChannelCallback} callback Per-channel callback.  Called when each channel's atlased volume data is loaded
   * @returns {Promise<Volume>}
   */
  static async loadZarr(urlStore: string, imageName: string, t: number, callback: PerChannelCallback): Promise<Volume> {
    const store = new HTTPStore(urlStore);

    const imagegroup = imageName;

    const data = await openGroup(store, imagegroup, "r");

    // get top-level metadata for this zarr image
    const allmetadata = await data.attrs.asObject();
    //const numlevels = allmetadata.multiscales[0].datasets.length;
    // get raw scaling for level 0
    // each entry of multiscales is a multiscale image.
    const imageIndex = 0;
    // there is one dataset for each multiscale level.
    const dataset0 = allmetadata.multiscales[imageIndex].datasets[0];
    // technically there can be any number of coordinateTransformations
    // but there must be only one of type "scale".
    // Here I assume that is the only one.
    const scale5d = dataset0.coordinateTransformations[0].scale;

    // TODO get metadata sizes for each level?  how inefficient is that?
    // update levelToLoad after we get size info about multiscales?

    const metadata = allmetadata.omero;

    const level0 = await openArray({ store: store, path: imagegroup + "/" + dataset0.path, mode: "r" });
    // full res info
    const w = level0.meta.shape[4];
    const h = level0.meta.shape[3];
    const z = level0.meta.shape[2];
    const c = level0.meta.shape[1];
    const sizeT = level0.meta.shape[0];
    console.log(`X=${w}, Y=${h}, Z=${z}, C=${c}, T=${sizeT}`);

    // making a choice of a reduced level:
    const levelToLoad = 1;
    const dataset2 = allmetadata.multiscales[imageIndex].datasets[levelToLoad];
    const level = await openArray({ store: store, path: imagegroup + "/" + dataset2.path, mode: "r" });

    // reduced level info
    const tw = level.meta.shape[4];
    const th = level.meta.shape[3];

    // compute rows and cols and atlas width and ht, given tw and th
    let nextrows = 1;
    let nextcols = z;
    let ratio = (nextcols * tw) / (nextrows * th);
    let nrows = nextrows;
    let ncols = nextcols;
    while (ratio > 1) {
      nrows = nextrows;
      ncols = nextcols;
      nextcols -= 1;
      nextrows = Math.ceil(z / nextcols);
      ratio = (nextcols * tw) / (nextrows * th);
    }
    const atlaswidth = ncols * tw;
    const atlasheight = nrows * th;
    console.log(atlaswidth, atlasheight);

    const chnames: string[] = [];
    for (let i = 0; i < metadata.channels.length; ++i) {
      chnames.push(metadata.channels[i].label);
    }
    const imgdata: ImageInfo = {
      width: w,
      height: h,
      channels: c,
      channel_names: chnames,
      rows: nrows,
      cols: ncols,
      tiles: z,
      tile_width: tw,
      tile_height: th,
      // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048
      // and ideally a power of 2.  This generally implies downsampling the original volume data for display in this viewer.
      atlas_width: atlaswidth,
      atlas_height: atlasheight,
      pixel_size_x: scale5d[4],
      pixel_size_y: scale5d[3],
      pixel_size_z: scale5d[2],
      name: metadata.name,
      version: metadata.version,
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      times: sizeT,
    };

    // got some data, now let's construct the volume.
    const vol = new Volume(imgdata);

    // level.get([0, null, null, null, null]).then((timesample) => {
    //   timesample = timesample as NestedArray<TypedArray>;
    //   const nc = timesample.shape[0];
    //   const nz = timesample.shape[1];
    //   const ny = timesample.shape[2];
    //   const nx = timesample.shape[3];
    //   for (let i = 0; i < nc; ++i) {
    //     // TODO put this in a webworker??
    //     const u8 = convertChannel(timesample.data[i] as TypedArray[][], nx, ny, nz, timesample.dtype);
    //     vol.setChannelDataFromVolume(i, u8);
    //     if (callback) {
    //       // make up a unique name? or have caller pass this in?
    //       callback(urlStore + "/" + imageName, i);
    //     }
    //   }
    // });

    // for (let i = 0; i < c; ++i) {
    //   level.get([0, i, null, null, null]).then((channel) => {
    //     channel = channel as NestedArray<TypedArray>;
    //     const nz = channel.shape[0];
    //     const ny = channel.shape[1];
    //     const nx = channel.shape[2];
    //     // TODO put this in a webworker??
    //     const u8 = convertChannel(channel.data as TypedArray[][], nx, ny, nz, channel.dtype);
    //     console.log("begin setchannel and callback");
    //     vol.setChannelDataFromVolume(i, u8);
    //     if (callback) {
    //       // make up a unique name? or have caller pass this in?
    //       callback(urlStore + "/" + imageName, i);
    //     }
    //     console.log("end setchannel and callback");
    //   });
    // }
    const storepath = imagegroup + "/" + dataset2.path;
    for (let i = 0; i < c; ++i) {
      const worker = new Worker(new URL("./workers/FetchZarrWorker.ts", import.meta.url));
      worker.onmessage = function (e) {
        const u8 = e.data.data;
        const channel = e.data.channel;
        console.log("begin setchannel and callback");
        vol.setChannelDataFromVolume(channel, u8);
        if (callback) {
          // make up a unique name? or have caller pass this in?
          callback(urlStore + "/" + imageName, channel);
        }
        console.log("end setchannel and callback");
        worker.terminate();
      };
      worker.onerror = function (e) {
        alert("Error: Line " + e.lineno + " in " + e.filename + ": " + e.message);
      };
      worker.postMessage({ urlStore: urlStore, time: Math.min(t, sizeT), channel: i, path: storepath });
    }

    return vol;
  }

  static async loadOpenCell(callback: PerChannelCallback): Promise<Volume> {
    const numChannels = 2;

    // HQTILE or LQTILE
    // make a json metadata dict for the two channels:
    const urls = [
      {
        name: "czML0383-P0002-G11-PML0146-S04_ROI-0000-0000-0600-0600-LQTILE-CH405.jpeg",
        channels: [0],
      },
      {
        name: "czML0383-P0002-G11-PML0146-S04_ROI-0000-0000-0600-0600-LQTILE-CH488.jpeg",
        channels: [1],
      },
    ];
    // we know these are standardized to 600x600, two channels, one channel per jpg.
    const chnames: string[] = ["DNA", "Structure"];

    const imgdata: ImageInfo = {
      width: 600,
      height: 600,
      channels: numChannels,
      channel_names: chnames,
      rows: 27,
      cols: 1,
      tiles: 27,
      tile_width: 600,
      tile_height: 600,
      // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048
      // and ideally a power of 2.  This generally implies downsampling the original volume data for display in this viewer.
      atlas_width: 600,
      atlas_height: 16200,
      pixel_size_x: 1,
      pixel_size_y: 1,
      pixel_size_z: 2,
      name: "TEST",
      version: "1.0",
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      times: 1,
    };

    // got some data, now let's construct the volume.
    const vol = new Volume(imgdata);
    this.loadVolumeAtlasData(vol, urls, callback);
    return vol;
  }
}
