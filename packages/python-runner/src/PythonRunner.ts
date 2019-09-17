import {Kernel} from '@jupyterlab/services';
import {CodeEditor} from '@jupyterlab/codeeditor';
import {Dialog, showDialog} from "@jupyterlab/apputils";

/**
 * Class: An enhanced Python Script Editor that enables developing and running the script
 */
export class PythonRunner {
    kernel : Kernel.IKernel;
    model: CodeEditor.IModel;
    kernelSettings: Kernel.IOptions;

  /**
   * Construct a new runner.
   */
    constructor(model: CodeEditor.IModel){
        this.kernel = null;
        this.model = model;
    }

    /**
     * Function: Starts a python kernel and executes code from file editor.
     */
    runPython = async (kernelSettings: Kernel.IOptions, handleKernelMsg: Function) => {
        if (!this.kernel) {
          const model = this.model;
          const code: string = model.value.text;

          try {
            this.kernel = await this.startKernel(kernelSettings);
          } catch (e) {
            return showDialog({
              title: 'Error',
              body: 'Could not start kernel environment to execute script.',
              buttons: [Dialog.okButton()]
            });
          }

          if (! this.kernel) {
            // kernel didn't get started
            return showDialog({
              title: 'Error',
              body: 'Could not start kernel environment to execute script.',
              buttons: [Dialog.okButton()]
            });
          } else if ( ! this.kernel.ready ) {
            // kernel started, but something is not right and
            // the kernel is not ready
            return showDialog({
              title: 'Error',
              body: 'Kernel environment not ready to execute script.',
              buttons: [Dialog.okButton()]
            });
          }

          const future = this.kernel.requestExecute({ code });

          future.onIOPub = (msg: any) => {
            let msgOutput: any = {};

            if (msg.msg_type === 'error') {
              msgOutput.error = {
                type: msg.content.ename,
                output: msg.content.evalue
              }
            } else if (msg.msg_type === 'execute_result') {
              if('text/plain' in msg.content.data) {
                msgOutput.output = msg.content.data['text/plain'];
              } else {
                // ignore
                console.log('Ignoring received message ' + msg)
              }
            } else if (msg.msg_type === 'stream' ) {
              msgOutput.output = msg.content.text;
            } else if (msg.msg_type === 'status'){
              msgOutput.status = msg.content.execution_state;
            } else {
              // ignore other message types
            }

            // Notify UI
            handleKernelMsg(msgOutput);
          };

          try {
            await future.done;
            this.shutDownKernel();

          } catch (e) {
            console.log('Exception: done = ' + JSON.stringify(e));
          }
        }
      };

  /**
   * Function: Gets available kernel specs.
   */
    getKernelSpecs = async () => {
      const kernelSpecs = await Kernel.getSpecs();
      return kernelSpecs;
    };

  /**
   * Function: Starts new kernel.
   */
    startKernel = async (options: Kernel.IOptions) => {
      return Kernel.startNew(options);
    };

  /**
   * Function: Shuts down kernel.
   */
    shutDownKernel = async () => {
      if (this.kernel) {
        const name = this.kernel.name;

        try {
          const tempKernel = this.kernel;
          this.kernel = null;
          await tempKernel.shutdown();
          console.log(name + ' kernel shut down');
        } catch (e) {
          console.log('Exception: shutdown = ' + JSON.stringify(e));
        }
      }
    }
}
