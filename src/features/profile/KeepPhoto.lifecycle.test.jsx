/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act, cleanup } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'me', options);
const { blob } = vi.hoisted(() => ({ blob: vi.fn() }));
vi.mock("../home/mediaSessionApi.js", () => ({ mediaApi: { blob } }));
import KeepPhoto from "./KeepPhoto.jsx";
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL=vi.fn(()=>"blob:owned");URL.revokeObjectURL=vi.fn(); });
afterEach(cleanup);
it("does not allocate a Blob URL for a late result after unmount", async () => {
 let finish;blob.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const view=render(<KeepPhoto item={{id:"one"}} />);view.unmount();await act(async()=>finish(new Blob(["synthetic"])));
 expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("isolates reversed StrictMode completions and releases only the current owned media", async () => {
 const finish=[];blob.mockImplementation(()=>new Promise(resolve=>finish.push(resolve)));
 const view=render(<React.StrictMode><KeepPhoto item={{id:"one",note:"own photo"}} /></React.StrictMode>);
 expect(finish).toHaveLength(2);await act(async()=>finish[1](new Blob(["second"])));await act(async()=>finish[0](new Blob(["first"])));
 expect(screen.getByRole("img")).toHaveAttribute("src","blob:owned");expect(URL.createObjectURL).toHaveBeenCalledOnce();view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:owned");
});
it("removes the old photo immediately on identity change and shows denial without a signing fallback", async () => {
 blob.mockResolvedValueOnce(new Blob(["first"]));const view=render(<KeepPhoto item={{id:"one"}} />);await screen.findByRole("img");
 blob.mockRejectedValueOnce(new Error("media_denied"));view.rerender(<KeepPhoto item={{id:"two"}} />);
 expect(screen.queryByRole("img")).not.toBeInTheDocument();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:owned");
 expect(await screen.findByText(/Photo unavailable/)).toBeInTheDocument();expect(blob).toHaveBeenLastCalledWith("keeps/frame",{keepId:"two"},{authScope:expect.objectContaining({user:'me'})});
});
